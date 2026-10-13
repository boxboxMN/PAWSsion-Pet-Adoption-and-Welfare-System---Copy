
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const { Readable } = require("stream");

async function uploadToCloudinary(file, folder) {
    if (!file) return null;

    let result;

    if (file.path) {
        // Multer disk storage
        try {
            result = await cloudinary.uploader.upload(file.path, {
                folder,
                resource_type: "image"
            });
        } finally {
            // Remove the temporary local upload after attempting Cloudinary upload
            fs.promises.unlink(file.path).catch(() => {});
        }
    } else if (file.buffer) {
        // Multer memory storage
        result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: "image"
                },
                (error, uploadedFile) => {
                    if (error) return reject(error);
                    resolve(uploadedFile);
                }
            );

            Readable.from(file.buffer).pipe(stream);
        });
    } else {
        throw new Error("Uploaded file has no path or buffer.");
    }

    if (!result || !result.secure_url) {
        throw new Error("Cloudinary did not return a secure image URL.");
    }

    return result.secure_url;
}

module.exports = { uploadToCloudinary };
