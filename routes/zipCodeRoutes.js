const express = require("express");

const router = express.Router();

let postalDataCache = null;
let postalDataCacheExpiresAt = 0;

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

async function loadPostalData() {
    if (
        postalDataCache &&
        Date.now() < postalDataCacheExpiresAt
    ) {
        return postalDataCache;
    }

    const response = await fetch(
        "https://raw.githubusercontent.com/jayson-panganiban/phzipcodes/main/phzipcodes/data/ph_zip_codes.json"
    );

    if (!response.ok) {
        throw new Error("Unable to fetch ZIP code data.");
    }

    const data = await response.json();

    postalDataCache = data;
    postalDataCacheExpiresAt =
        Date.now() + CACHE_DURATION;

    return data;
}

function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

router.get("/zip", async (req, res) => {
    try {
        const province = String(
            req.query.province || ""
        ).trim();

        const city = String(
            req.query.city || ""
        ).trim();

        if (!province || !city) {
            return res.status(400).json({
                found: false,
                zip_code: null,
                message:
                    "Province and city/municipality are required."
            });
        }

        const postalData = await loadPostalData();

        const provinceNormalized = normalize(province);
        const cityNormalized = normalize(city);

        let foundZip = null;
        let matchedProvince = null;
        let matchedCity = null;

        for (const regionName of Object.keys(postalData)) {
            const provinces = postalData[regionName];

            for (const provinceName of Object.keys(provinces)) {
                const normalizedDatasetProvince = normalize(provinceName);

                if (
                    normalizedDatasetProvince !== provinceNormalized &&
                    !normalizedDatasetProvince.startsWith(provinceNormalized) &&
                    !provinceNormalized.startsWith(normalizedDatasetProvince)
                ) {
                    continue;
                }

                const cities = provinces[provinceName];

                for (const cityName of Object.keys(cities)) {
                    if (
                        normalize(cityName) !==
                        cityNormalized
                    ) {
                        continue;
                    }

                    const zipCodes = cities[cityName];

                    if (
                        Array.isArray(zipCodes) &&
                        zipCodes.length > 0
                    ) {
                        foundZip = String(zipCodes[0]);
                        matchedProvince = provinceName;
                        matchedCity = cityName;
                    }

                    break;
                }

                break;
            }

            if (foundZip) break;
        }

        if (!foundZip) {
            return res.status(404).json({
                found: false,
                zip_code: null,
                message:
                    "ZIP code is unavailable for the selected city."
            });
        }

        return res.json({
            found: true,
            zip_code: foundZip,
            province: matchedProvince,
            city: matchedCity,
            source: "PHLPost-derived ZIP data"
        });

    } catch (error) {
        console.error("ZIP API error:", error);

        return res.status(500).json({
            found: false,
            zip_code: null,
            message:
                "Unable to retrieve ZIP code."
        });
    }
});

module.exports = router;