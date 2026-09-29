const axios = require("axios");
const pool = require("../config/database");
const { generateEmbedding } = require("./embeddingService");
const MATCH_THRESHOLD = 0.40;
// =========================================
// COSINE SIMILARITY
// =========================================
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
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
    

    // Generate ONE embedding for the adopter's description
    const embeddingResult = await generateEmbedding(behavior);

    const userEmbedding = embeddingResult.embedding;
    const repairedBehavior = embeddingResult.repairedText;
    // Load pets together with their embeddings
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
    const matchLogs = [];

    for (const pet of pets) {
        const [medicalHistory] = await pool.query(`
            SELECT
                treatment,
                DATE_FORMAT(administered_date, '%M %e, %Y') AS administered_date,
                administered_by,
                notes
            FROM animal_medical_history
            WHERE animal_id = ?
            ORDER BY administered_date DESC;
        `, [pet.animal_id]);

        // Convert JSON stored in MySQL
        const petEmbedding = typeof pet.embedding === "string" ? JSON.parse(pet.embedding) : pet.embedding;

        // Cosine similarity (-1 to 1) and normalize to 0-1
        const similarity = cosineSimilarity(userEmbedding, petEmbedding);
        let behaviorSimilarity = (similarity + 1) / 2;

        // -----------------------------------
        // Smooth Boost
        // -----------------------------------
        // Only boost if already a decent match.
        if (behaviorSimilarity >= 0.50) {
            // Increase by up to 20% of the remaining distance to 1.0
            behaviorSimilarity += (1 - behaviorSimilarity) * 0.20;
        }

        // =========================================
        // SEX & AGE SCORES
        // =========================================
        const sexScore = sex === "Any" ? 1 : (pet.gender === sex ? 1 : 0);
        const ageScore = age === "Any" ? 1 : (pet.age === age ? 1 : 0);

        // =========================================
        // FIXED WEIGHTS
        // =========================================

        const behaviorWeight = 0.70;
        const ageWeight = 0.20;
        const sexWeight = 0.10;

        // =========================================
        // FINAL MATCH SCORE
        // =========================================
        
        const finalScore = (behaviorSimilarity * behaviorWeight) + (ageScore * ageWeight) + (sexScore * sexWeight);

        // =========================================
        // MATCH THRESHOLD
        // =========================================
        // Only pets ABOVE 40% are included.
        // 40% or below = excluded.
        const included = finalScore > MATCH_THRESHOLD;
        matchLogs.push({
            petName: pet.name,
            similarity,
            behaviorSimilarity,
            sexScore,
            ageScore,
            behaviorWeight,
            ageWeight,
            sexWeight,
            finalScore,
            included
        });

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
            behaviorSimilarity: Number((behaviorSimilarity * 100).toFixed(2)),
            ageScore: ageScore * 100,
            sexScore: sexScore * 100,
            score: Number((finalScore * 100).toFixed(1)),
            behaviorContribution: Math.round(behaviorSimilarity * behaviorWeight * 100),
            ageContribution: Math.round(ageScore * ageWeight * 100),
            sexContribution: Math.round(sexScore * sexWeight * 100)
        });

    }

    // Highest score first
    matches.sort((a, b) => b.score - a.score);
    matchLogs.sort((a, b) => b.finalScore - a.finalScore);

    for (const log of matchLogs) {
        console.log("====================================");
        console.log("Pet:", log.petName);
        console.log("Raw Cosine Similarity:", log.similarity.toFixed(4));
        console.log("Behavior Similarity :", (log.behaviorSimilarity * 100).toFixed(2) + "%");
        console.log("Sex Match :", sex === "Any" ? "ANY" : (log.sexScore === 1 ? "YES" : "NO"));
        console.log("Age Match :", age === "Any" ? "ANY" : (log.ageScore === 1 ? "YES" : "NO"));
        console.log("Behavior Weight       :", (log.behaviorWeight * 100).toFixed(0) + "%");
        console.log("Age Weight            :", (log.ageWeight * 100).toFixed(0) + "%");
        console.log("Sex Weight            :", (log.sexWeight * 100).toFixed(0) + "%");
        console.log("Behavior Contribution :", (log.behaviorSimilarity * log.behaviorWeight * 100).toFixed(2) + "%");
        console.log("Age Contribution      :", (log.ageScore * log.ageWeight * 100).toFixed(2) + "%");
        console.log("Sex Contribution      :", (log.sexScore * log.sexWeight * 100).toFixed(2) + "%");
        console.log("------------------------------------");
        console.log("FINAL MATCH SCORE     :", (log.finalScore * 100).toFixed(2) + "%");
        if (log.included) {
            console.log(`INCLUDED: ${log.petName} - Final Match Score ${(log.finalScore * 100).toFixed(2)}% passed the 40% threshold.`);
        } else {
            console.log(`EXCLUDED: ${log.petName} - Final Match Score ${(log.finalScore * 100).toFixed(2)}% is at or below the 40% threshold.`);
        }
        console.log("====================================\n");
    }

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
            process.env.FLASK_API_URL || "http://localhost:5000";

        console.log("========================================");
        console.log("CALLING FLASK REPAIR");
        console.log(
            "FLASK URL:",
            `${FLASK_API_URL}/repair`
        );
        console.log("TEXT:", behavior);
        console.log("========================================");

        const response = await axios.post(
            `${FLASK_API_URL}/repair`,
            {
                text: behavior
            }
        );

        console.log("========================================");
        console.log("FLASK REPAIR RESPONSE");
        console.log("========================================");
        console.log(response.data);
        console.log("========================================");

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