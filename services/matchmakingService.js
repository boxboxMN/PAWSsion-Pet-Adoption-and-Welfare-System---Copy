const axios = require("axios");
const pool = require("../config/database");
const { generateEmbedding } = require("./embeddingService");

const MATCH_THRESHOLD = 0.40;

// =========================================
// COSINE SIMILARITY
// =========================================
function cosineSimilarity(vecA, vecB) {

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// =========================================
// MATCH PETS
// =========================================
async function matchPets(preferences) {

    const {
        type,
        sex,
        age,
        behavior
    } = preferences;

    // =========================================
    // GENERATE ADOPTER BEHAVIOR EMBEDDING
    // =========================================
    const embeddingResult = await generateEmbedding(behavior);

    const userEmbedding = embeddingResult.embedding;
    const repairedBehavior = embeddingResult.repairedText;

    // =========================================
    // LOAD AVAILABLE PETS
    // =========================================
    const [pets] = await pool.query(`
        SELECT
            a.animal_id,
            a.name,
            a.species,
            a.gender,
            a.age,
            a.pet_description,
            a.image_path,
            a.organization_id,
            o.organization_name,
            a.adoption_status,
            a.health_status,
            a.vaccination_status,
            ae.embedding
        FROM animals a

        INNER JOIN animal_embeddings ae
            ON a.animal_id = ae.animal_id

        INNER JOIN organizations o
            ON a.organization_id = o.organization_id

        WHERE a.adoption_status = 'Available'

        -- Exclude pets with active adoption applications
        AND NOT EXISTS (
            SELECT 1
            FROM user_adoption_applications uaa
            WHERE uaa.animal_id = a.animal_id
            AND uaa.status IN (
                'Under Review',
                'Interview Scheduled',
                'Approved'
            )
        )

        ${type !== "Any" ? "AND a.species = ?" : ""}
    `, type !== "Any" ? [type] : []);

    const matches = [];

    // Store console information separately.
    // This allows us to print everything AFTER sorting.
    const matchAnalyses = [];

    // =========================================
    // MATCH EACH PET
    // =========================================
    for (const pet of pets) {

        // =========================================
        // LOAD MEDICAL HISTORY
        // =========================================
        const [medicalHistory] = await pool.query(`
            SELECT
                treatment,
                DATE_FORMAT(
                    administered_date,
                    '%M %e, %Y'
                ) AS administered_date,
                administered_by,
                notes
            FROM animal_medical_history
            WHERE animal_id = ?
            ORDER BY administered_date DESC;
        `, [pet.animal_id]);

        // =========================================
        // CONVERT PET EMBEDDING
        // =========================================
        const petEmbedding =
            typeof pet.embedding === "string"
                ? JSON.parse(pet.embedding)
                : pet.embedding;

        // =========================================
        // COSINE SIMILARITY
        // =========================================
        const similarity = cosineSimilarity(
            userEmbedding,
            petEmbedding
        );

        // Normalize cosine similarity from -1 to 1
        // into a 0 to 1 range.
        let behaviorSimilarity =
            (similarity + 1) / 2;

        // =========================================
        // SMOOTH BOOST
        // =========================================
        // PRESERVED FROM YOUR ORIGINAL CODE.
        //
        // Only applies when behavior similarity
        // is already at least 50%.
        if (behaviorSimilarity >= 0.50) {

            behaviorSimilarity +=
                (1 - behaviorSimilarity) * 0.20;
        }

        // =========================================
        // AGE & SEX MATCH
        // =========================================
        const sexScore =
            sex === "Any"
                ? 1
                : (pet.gender === sex ? 1 : 0);

        const ageScore =
            age === "Any"
                ? 1
                : (pet.age === age ? 1 : 0);

        // =========================================
        // FIXED WEIGHTS
        // =========================================
        const behaviorWeight = 0.70;
        const ageWeight = 0.20;
        const sexWeight = 0.10;

        // =========================================
        // FINAL MATCH SCORE
        // =========================================
        const finalScore =
            (behaviorSimilarity * behaviorWeight) +
            (ageScore * ageWeight) +
            (sexScore * sexWeight);

        // =========================================
        // THRESHOLD CHECK
        // =========================================
        const included =
            finalScore > MATCH_THRESHOLD;

        // =========================================
        // STORE ANALYSIS FOR CONSOLE
        // =========================================
        matchAnalyses.push({

            animal_id: pet.animal_id,
            name: pet.name,

            rawCosineSimilarity: similarity,

            behaviorSimilarity:
                behaviorSimilarity,

            ageScore:
                ageScore,

            sexScore:
                sexScore,

            behaviorWeight:
                behaviorWeight,

            ageWeight:
                ageWeight,

            sexWeight:
                sexWeight,

            behaviorContribution:
                behaviorSimilarity *
                behaviorWeight,

            ageContribution:
                ageScore *
                ageWeight,

            sexContribution:
                sexScore *
                sexWeight,

            finalScore:
                finalScore,

            included:
                included
        });

        // =========================================
        // ADD QUALIFYING PET TO MATCH RESULTS
        // =========================================
        if (!included) {
            continue;
        }

        matches.push({
            animal_id: pet.animal_id,
            name: pet.name,
            species: pet.species,
            gender: pet.gender,
            age: pet.age,
            image_path: pet.image_path,
            pet_description: pet.pet_description,
            organization_id: pet.organization_id,
            organization_name: pet.organization_name,
            adoption_status: pet.adoption_status,
            health_status: pet.health_status,
            vaccination_status: pet.vaccination_status,
            medical_history: medicalHistory,

            behaviorSimilarity:
                Number(
                    (behaviorSimilarity * 100)
                        .toFixed(2)
                ),

            ageScore:
                ageScore * 100,

            sexScore:
                sexScore * 100,

            score:
                Number(
                    (finalScore * 100)
                        .toFixed(1)
                ),

            behaviorContribution:
                Math.round(
                    behaviorSimilarity *
                    behaviorWeight *
                    100
                ),

            ageContribution:
                Math.round(
                    ageScore *
                    ageWeight *
                    100
                ),

            sexContribution:
                Math.round(
                    sexScore *
                    sexWeight *
                    100
                )
        });
    }

    // =========================================
    // SORT FINAL MATCHES
    // =========================================
    matches.sort(
        (a, b) => b.score - a.score
    );

    // =========================================
    // SORT CONSOLE ANALYSIS
    // =========================================
    // This makes the console follow the SAME
    // order as the displayed match results.
    matchAnalyses.sort(
        (a, b) => b.finalScore - a.finalScore
    );

    // =========================================
    // PRINT MATCH ANALYSIS
    // =========================================
    //
    // IMPORTANT:
    // Each pet's complete console output is built
    // into ONE string and printed with ONE console.log().
    //
    // This prevents different lines from different
    // match requests from being inserted between
    // the lines of one pet's analysis.
    //
    for (const analysis of matchAnalyses) {

        const output = [
            "",
            "========================================",
            `PET MATCH ANALYSIS: ${analysis.name}`,
            "========================================",

            `Raw Cosine Similarity : ${analysis.rawCosineSimilarity.toFixed(4)}`,

            `Behavior Similarity   : ${(analysis.behaviorSimilarity * 100).toFixed(2)}%`,

            "----------------------------------------",

            `Age Match             : ${
                age === "Any"
                    ? "ANY"
                    : (analysis.ageScore === 1
                        ? "MATCH"
                        : "NO MATCH")
            }`,

            `Sex Match             : ${
                sex === "Any"
                    ? "ANY"
                    : (analysis.sexScore === 1
                        ? "MATCH"
                        : "NO MATCH")
            }`,

            "----------------------------------------",

            `Behavior Weight       : ${(analysis.behaviorWeight * 100).toFixed(0)}%`,
            `Age Weight            : ${(analysis.ageWeight * 100).toFixed(0)}%`,
            `Sex Weight            : ${(analysis.sexWeight * 100).toFixed(0)}%`,

            "----------------------------------------",

            `Behavior Contribution : ${(analysis.behaviorContribution * 100).toFixed(2)}%`,
            `Age Contribution      : ${(analysis.ageContribution * 100).toFixed(2)}%`,
            `Sex Contribution      : ${(analysis.sexContribution * 100).toFixed(2)}%`,

            "----------------------------------------",

            `FINAL MATCH SCORE     : ${(analysis.finalScore * 100).toFixed(2)}%`,
            `MATCH THRESHOLD       : ${(MATCH_THRESHOLD * 100).toFixed(0)}%`,

            "----------------------------------------",

            `RESULT                : ${
                analysis.included
                    ? "INCLUDED"
                    : "EXCLUDED"
            }`,

            `REASON                : ${
                analysis.included
                    ? `Final Match Score passed the ${MATCH_THRESHOLD * 100}% threshold.`
                    : `Final Match Score is at or below the ${MATCH_THRESHOLD * 100}% threshold.`
            }`,

            "========================================",
            ""
        ].join("\n");

        console.log(output);
    }

    // =========================================
    // RETURN MATCH RESULTS
    // =========================================
    return {
        matches,
        repairedBehavior
    };
}

// ==========================================================
// REPAIR BEHAVIOR
// ==========================================================
async function repairBehavior(behavior) {

    try {

        const FLASK_API_URL =
            process.env.FLASK_API_URL ||
            "http://localhost:5000";

        console.log("========================================");
        console.log("CALLING FLASK REPAIR");
        console.log(
            "FLASK URL:",
            `${FLASK_API_URL}/repair`
        );
        console.log(
            "BEHAVIOR:",
            behavior
        );
        console.log("========================================");

        const response = await axios.post(
            `${FLASK_API_URL}/repair`,
            {
                text: behavior
            }
        );

        console.log("========================================");
        console.log("FLASK REPAIR RESPONSE");
        console.log(response.data);
        console.log("========================================");

        return response.data;

    } catch (error) {

        console.error("========================================");
        console.error("FLASK REPAIR ERROR");
        console.error("========================================");

        if (error.response) {

            console.error(
                "Flask status:",
                error.response.status
            );

            console.error(
                "Flask response:",
                error.response.data
            );

            const flaskError = new Error(
                error.response.data.message ||
                "Invalid behavior description."
            );

            flaskError.status =
                error.response.status;

            flaskError.repairedText =
                error.response.data.repaired_text;

            flaskError.wordCount =
                error.response.data.word_count;

            flaskError.characterCount =
                error.response.data.character_count;

            throw flaskError;
        }

        console.error(
            "Error message:",
            error.message
        );

        throw error;
    }
}

// ==========================================================
// EXPORT
// ==========================================================
module.exports = {
    matchPets,
    repairBehavior
};