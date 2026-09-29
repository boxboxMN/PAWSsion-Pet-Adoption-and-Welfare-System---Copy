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

    // =========================================
    // CHECK EACH PET
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
        // CONVERT PET EMBEDDING FROM JSON
        // =========================================
        const petEmbedding =
            typeof pet.embedding === "string"
                ? JSON.parse(pet.embedding)
                : pet.embedding;

        // =========================================
        // COSINE SIMILARITY
        // =========================================

        // Raw cosine similarity ranges from -1 to 1.
        const similarity = cosineSimilarity(
            userEmbedding,
            petEmbedding
        );

        // Normalize cosine similarity to a 0-1 range.
        let behaviorSimilarity =
            (similarity + 1) / 2;

        // =========================================
        // BEHAVIOR SIMILARITY BOOST
        // =========================================
        // Only apply the boost when the normalized
        // behavior similarity is already at least 50%.
        if (behaviorSimilarity >= 0.50) {

            // Increase by up to 20% of the remaining
            // distance toward 1.0.
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
        // CONSOLE MATCH ANALYSIS
        // =========================================

        console.log("\n========================================");
        console.log(`PET MATCH ANALYSIS: ${pet.name}`);
        console.log("========================================");

        // -----------------------------------------
        // BEHAVIOR SIMILARITY
        // -----------------------------------------

        console.log(
            "Raw Cosine Similarity :",
            similarity.toFixed(4)
        );

        console.log(
            "Behavior Similarity    :",
            (behaviorSimilarity * 100).toFixed(2) + "%"
        );

        console.log("----------------------------------------");

        // -----------------------------------------
        // AGE & SEX MATCH
        // -----------------------------------------

        console.log(
            "Age Match              :",
            age === "Any"
                ? "ANY"
                : (ageScore === 1 ? "MATCH" : "NO MATCH")
        );

        console.log(
            "Sex Match              :",
            sex === "Any"
                ? "ANY"
                : (sexScore === 1 ? "MATCH" : "NO MATCH")
        );

        console.log("----------------------------------------");

        // -----------------------------------------
        // MATCH WEIGHTS
        // -----------------------------------------

        console.log(
            "Behavior Weight        :",
            (behaviorWeight * 100).toFixed(0) + "%"
        );

        console.log(
            "Age Weight             :",
            (ageWeight * 100).toFixed(0) + "%"
        );

        console.log(
            "Sex Weight             :",
            (sexWeight * 100).toFixed(0) + "%"
        );

        console.log("----------------------------------------");

        // -----------------------------------------
        // WEIGHTED CONTRIBUTIONS
        // -----------------------------------------

        console.log(
            "Behavior Contribution  :",
            (behaviorSimilarity * behaviorWeight * 100)
                .toFixed(2) + "%"
        );

        console.log(
            "Age Contribution       :",
            (ageScore * ageWeight * 100)
                .toFixed(2) + "%"
        );

        console.log(
            "Sex Contribution       :",
            (sexScore * sexWeight * 100)
                .toFixed(2) + "%"
        );

        console.log("----------------------------------------");

        // -----------------------------------------
        // FINAL MATCH SCORE
        // -----------------------------------------

        console.log(
            "FINAL MATCH SCORE      :",
            (finalScore * 100).toFixed(2) + "%"
        );

        console.log(
            "MATCH THRESHOLD        :",
            (MATCH_THRESHOLD * 100).toFixed(0) + "%"
        );

        // =========================================
        // MATCH THRESHOLD
        // =========================================

        // Only pets ABOVE 40% are included.
        // 40% or below = excluded.

        if (finalScore <= MATCH_THRESHOLD) {

            console.log(
                "RESULT                 : EXCLUDED"
            );

            console.log(
                "REASON                 :",
                `Final Match Score is at or below the ` +
                `${MATCH_THRESHOLD * 100}% threshold.`
            );

            console.log(
                "========================================\n"
            );

            continue;
        }

        // =========================================
        // PET PASSED MATCH THRESHOLD
        // =========================================

        console.log(
            "RESULT                 : INCLUDED"
        );

        console.log(
            "REASON                 :",
            `Final Match Score passed the ` +
            `${MATCH_THRESHOLD * 100}% threshold.`
        );

        console.log(
            "========================================\n"
        );

        // =========================================
        // ADD PET TO MATCH RESULTS
        // =========================================

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

            // Behavior similarity after normalization
            // and the smooth boost.
            behaviorSimilarity:
                Number(
                    (behaviorSimilarity * 100)
                        .toFixed(2)
                ),

            // Individual match indicators
            ageScore: ageScore * 100,
            sexScore: sexScore * 100,

            // Final weighted match score
            score:
                Number(
                    (finalScore * 100)
                        .toFixed(1)
                ),

            // Weighted contributions
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
    // SORT MATCHES BY HIGHEST SCORE
    // =========================================

    matches.sort((a, b) => b.score - a.score);

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

        // =========================================
        // CALL FLASK REPAIR
        // =========================================

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

        // =========================================
        // FLASK REPAIR RESPONSE
        // =========================================

        console.log("========================================");
        console.log("FLASK REPAIR RESPONSE");
        console.log(response.data);
        console.log("========================================");

        return response.data;

    } catch (error) {
        // =========================================
        // FLASK REPAIR ERROR
        // =========================================
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