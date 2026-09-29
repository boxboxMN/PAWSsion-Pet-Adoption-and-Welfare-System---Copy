const axios = require("axios");
const pool = require("../config/database");
const { generateEmbedding } = require("./embeddingService");

const MATCH_THRESHOLD = 0.40;

// =========================================
// COSINE SIMILARITY
// =========================================
function cosineSimilarity(vecA, vecB) {

    if (
        !Array.isArray(vecA) ||
        !Array.isArray(vecB) ||
        vecA.length !== vecB.length
    ) {
        return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {

        dot += vecA[i] * vecB[i];

        normA += vecA[i] * vecA[i];

        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return (
        dot /
        (Math.sqrt(normA) * Math.sqrt(normB))
    );
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
// GENERATE ADOPTER EMBEDDING
// =========================================

const embeddingResult =
    await generateEmbedding(behavior);

const userEmbedding =
    embeddingResult.embedding;

const repairedBehavior =
    embeddingResult.repairedText;

// Validate adopter embedding
if (
    !Array.isArray(userEmbedding) ||
    userEmbedding.length !== 384
) {
    throw new Error(
        "Invalid adopter embedding. Expected 384 dimensions."
    );
}
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

        -- TYPE / SPECIES IS A HARD FILTER
        ${type !== "Any"
            ? "AND LOWER(TRIM(a.species)) = LOWER(TRIM(?))"
            : ""
        }

    `,
        type !== "Any"
            ? [type]
            : []
    );


    // =========================================
    // MATCH RESULTS
    // =========================================

    const matches = [];

    const matchLogs = [];


    // =========================================
    // PROCESS EACH PET
    // =========================================

    for (const pet of pets) {

        // =========================================
        // MEDICAL HISTORY
        // =========================================

        const [medicalHistory] =
            await pool.query(`
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
            `,
            [pet.animal_id]
        );


        // =========================================
        // CONVERT STORED JSON EMBEDDING
        // =========================================

        const petEmbedding =
            typeof pet.embedding === "string"
                ? JSON.parse(pet.embedding)
                : pet.embedding;


        // =========================================
        // RAW COSINE SIMILARITY
        // =========================================

        const rawSimilarity =
            cosineSimilarity(
                userEmbedding,
                petEmbedding
            );

        const adjustedSimilarity =
            rawSimilarity > 0.6
                ? Math.min(rawSimilarity + 0.05, 1)
                : rawSimilarity;


        // =========================================
        // SEX SCORE
        // =========================================

        const sexScore =
            sex === "Any"
                ? 1
                : (
                    pet.gender === sex
                        ? 1
                        : 0
                );


        // =========================================
        // AGE SCORE
        // =========================================

        const ageScore =
            age === "Any"
                ? 1
                : (
                    pet.age === age
                        ? 1
                        : 0
                );


        // =========================================
        // FIXED WSM WEIGHTS
        // =========================================

        const behaviorWeight = 0.70;

        const ageWeight = 0.20;

        const sexWeight = 0.10;


        // =========================================
        // WEIGHTED CONTRIBUTIONS
        // =========================================

        const behaviorContribution =
            adjustedSimilarity * behaviorWeight;

        const ageContribution =
            ageScore * ageWeight;

        const sexContribution =
            sexScore * sexWeight;


        // =========================================
        // FINAL MATCH SCORE
        // =========================================

        const finalScore =
            behaviorContribution +
            ageContribution +
            sexContribution;


        // =========================================
        // THRESHOLD
        // =========================================
        //
        // Only recommendations with a final
        // weighted score ABOVE 40% are included.
        //
        // =========================================

        const included =
            finalScore > MATCH_THRESHOLD;


        // =========================================
        // LOG MATCH CALCULATION
        // =========================================

        matchLogs.push({

            petName: pet.name,

            rawSimilarity,

            adjustedSimilarity,

            sexScore,

            ageScore,

            behaviorWeight,

            ageWeight,

            sexWeight,

            behaviorContribution,

            ageContribution,

            sexContribution,

            finalScore,

            included

        });


        // =========================================
        // EXCLUDE WEAK MATCH
        // =========================================

        if (!included) {
            continue;
        }


        // =========================================
        // SAVE MATCH RESULT
        // =========================================

        matches.push({

            animal_id: pet.animal_id,

            name: pet.name,

            species: pet.species,

            gender: pet.gender,

            age: pet.age,

            image_path: pet.image_path,

            pet_description:
                pet.pet_description,

            organization_id:
                pet.organization_id,

            organization_name:
                pet.organization_name,

            adoption_status:
                pet.adoption_status,

            health_status:
                pet.health_status,

            vaccination_status:
                pet.vaccination_status,

            medical_history:
                medicalHistory,


            // RAW COSINE SIMILARITY
            behaviorSimilarity:
                Number(
                    (adjustedSimilarity * 100)
                        .toFixed(2)
                ),


            // AGE COMPATIBILITY
            ageScore:
                ageScore * 100,


            // SEX COMPATIBILITY
            sexScore:
                sexScore * 100,


            // FINAL WSM SCORE
            score:
                Number(
                    (finalScore * 100)
                        .toFixed(1)
                ),


            // CONTRIBUTIONS
            behaviorContribution:
                Number(
                    (
                        adjustedSimilarity *
                        behaviorWeight *
                        100
                    ).toFixed(2)
                ),

            ageContribution:
                Number(
                    (
                        ageScore *
                        ageWeight *
                        100
                    ).toFixed(2)
                ),

            sexContribution:
                Number(
                    (
                        sexScore *
                        sexWeight *
                        100
                    ).toFixed(2)
                )

        });

    }


    // =========================================
    // SORT HIGHEST SCORE FIRST
    // =========================================

    matches.sort(
        (a, b) => b.score - a.score
    );


    // =========================================
    // SORT DEBUG LOGS
    // =========================================

    matchLogs.sort(
        (a, b) =>
            b.finalScore -
            a.finalScore
    );
// =========================================
// CONSOLE LOGGING
// =========================================

const matchmakingLog = matchLogs.map((log) => {

    const rawSimilarity =
        Number(log.rawSimilarity) || 0;

    const finalScore =
        Number(log.finalScore) || 0;

    const behaviorContribution =
        Number(log.behaviorContribution) || 0;

    const ageContribution =
        Number(log.ageContribution) || 0;

    const sexContribution =
        Number(log.sexContribution) || 0;

    const sexMatch =
        sex === "Any"
            ? "ANY"
            : (
                log.sexScore === 1
                    ? "YES"
                    : "NO"
            );

    const ageMatch =
        age === "Any"
            ? "ANY"
            : (
                log.ageScore === 1
                    ? "YES"
                    : "NO"
            );

    return [
        `[PET MATCH] ${log.petName}`,
        `Cosine Similarity : ${rawSimilarity.toFixed(4)}`,
        `Sex Match         : ${sexMatch}`,
        `Age Match         : ${ageMatch}`,
        `Weights           : Behavior 70% | Age 20% | Sex 10%`,
        `Contributions     : Behavior ${(behaviorContribution * 100).toFixed(2)}% | Age ${(ageContribution * 100).toFixed(2)}% | Sex ${(sexContribution * 100).toFixed(2)}%`,
        `Final Match Score : ${(finalScore * 100).toFixed(2)}%`,
        `Result            : ${log.included ? "INCLUDED" : "EXCLUDED"} — ${log.included ? "passed" : "did not pass"} the 40% threshold`
    ].join("\n");

}).join("\n\n");

console.log(
    "\n" +
    "========================================\n" +
    "         PAWPON MATCHMAKING RESULTS\n" +
    "========================================\n\n" +
    matchmakingLog +
    "\n\n" +
    "========================================\n"
);
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

        console.log(
            "========================================"
        );

        console.log(
            "CALLING FLASK REPAIR"
        );

        console.log(
            "FLASK URL:",
            `${FLASK_API_URL}/repair`
        );

        console.log(
            "TEXT:",
            behavior
        );

        console.log(
            "========================================"
        );


        const response =
            await axios.post(
                `${FLASK_API_URL}/repair`,
                {
                    text: behavior
                }
            );


        console.log(
            "========================================"
        );

        console.log(
            "FLASK REPAIR RESPONSE"
        );

        console.log(
            "========================================"
        );

        console.log(
            response.data
        );

        console.log(
            "========================================"
        );


        return response.data;


    } catch (error) {

        console.error(
            "========== FLASK REPAIR ERROR =========="
        );


        if (error.response) {

            console.error(
                "Flask status:",
                error.response.status
            );

            console.error(
                "Flask response:",
                error.response.data
            );


            const flaskError =
                new Error(
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
module.exports = {
    matchPets,
    repairBehavior
};