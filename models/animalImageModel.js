const pool = require("../config/database");

let tableReady;

async function ensureAnimalImagesTable() {
    if (!tableReady) {
        tableReady = pool.query(`
            CREATE TABLE IF NOT EXISTS animal_images (
                image_id INT NOT NULL AUTO_INCREMENT,
                animal_id INT NOT NULL,
                image_path VARCHAR(2048) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (image_id),
                KEY animal_id (animal_id),
                CONSTRAINT animal_images_animal_fk
                    FOREIGN KEY (animal_id) REFERENCES animals (animal_id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `).catch(error => {
            tableReady = null;
            throw error;
        });
    }

    await tableReady;
}

async function getAnimalImages(animalIds) {
    await ensureAnimalImagesTable();
    const imagePathsByAnimal = new Map();
    const uniqueIds = [...new Set(animalIds)];

    if (!uniqueIds.length) {
        return imagePathsByAnimal;
    }

    const [rows] = await pool.query(
        `SELECT animal_id, image_path FROM animal_images WHERE animal_id IN (?) ORDER BY animal_id, image_id`,
        [uniqueIds]
    );

    for (const row of rows) {
        const imagePaths = imagePathsByAnimal.get(row.animal_id) || [];
        if (!imagePaths.includes(row.image_path)) {
            imagePaths.push(row.image_path);
        }
        imagePathsByAnimal.set(row.animal_id, imagePaths);
    }

    return imagePathsByAnimal;
}

module.exports = {
    ensureAnimalImagesTable,
    getAnimalImages
};
