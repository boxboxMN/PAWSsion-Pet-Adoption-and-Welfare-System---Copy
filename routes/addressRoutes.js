// const express = require("express");

// const router = express.Router();

// // ==========================================
// // GEOAPIFY ADDRESS SEARCH
// // ==========================================
// router.get("/search", async (req, res) => {
//     try {
//         const apiKey = process.env.GEOAPIFY_API_KEY;

//         if (!apiKey) {
//             console.error("GEOAPIFY_API_KEY is missing.");

//             return res.status(500).json({
//                 error: "Address service is not configured."
//             });
//         }

//         const text = String(req.query.text || "").trim();

//         if (text.length < 2) {
//             return res.json({
//                 results: []
//             });
//         }

//         const params = new URLSearchParams({
//             text,
//             filter: "countrycode:ph",
//             limit: "5",
//             format: "json",
//             apiKey
//         });

//         const response = await fetch(
//             `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`
//         );

//         const data = await response.json();

//         if (!response.ok) {
//             console.error("Geoapify error:", data);

//             return res.status(response.status).json({
//                 error: "Unable to search for the address."
//             });
//         }

//         return res.json({
//             results: data.results || []
//         });

//     } catch (error) {
//         console.error("Address search error:", error);

//         return res.status(500).json({
//             error: "Unable to process address search."
//         });
//     }
// });

// module.exports = router;

const express = require("express");

const router = express.Router();

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;

let barangayPlaceCache = new Map();

const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 hours

function normalize(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[.,()-]/g, " ")
        .replace(/\s+/g, " ");
}

async function geoapifyRequest(url) {
    const response = await fetch(url);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            "Geoapify request failed."
        );
    }

    return data;
}

/**
 * Resolve the selected Barangay to a Geoapify place_id.
 */
async function resolveBarangayPlaceId(
    barangay,
    city,
    province
) {
    const cacheKey = [
        normalize(barangay),
        normalize(city),
        normalize(province)
    ].join("|");

    const cached = barangayPlaceCache.get(cacheKey);

    if (
        cached &&
        Date.now() < cached.expiresAt
    ) {
        return cached.placeId;
    }

    const searchText =
        `${barangay}, ${city}, ${province}, Philippines`;

    const params = new URLSearchParams({
        text: searchText,
        filter: "countrycode:ph",
        format: "json",
        limit: "5",
        apiKey: GEOAPIFY_API_KEY
    });

    const url =
        `https://api.geoapify.com/v1/geocode/search?${params.toString()}`;

    const data = await geoapifyRequest(url);

    const barangayNormalized =
        normalize(barangay);

    const cityNormalized =
        normalize(city);

    const candidates = Array.isArray(data.results)
        ? data.results
        : [];

    /*
     * Prefer results where the Barangay name itself
     * matches exactly, and where the city also matches.
     */
    const matchedResult = candidates
        .filter(result => {
            const resultCity =
                normalize(result.city);

            const name =
                normalize(result.name);

            const suburb =
                normalize(result.suburb);

            const district =
                normalize(result.district);

            const cityMatches =
                !resultCity ||
                resultCity === cityNormalized;

            const barangayMatches =
                name === barangayNormalized ||
                suburb === barangayNormalized ||
                district === barangayNormalized;

            return cityMatches && barangayMatches;
        })
        .find(result =>
            String(result.place_id || "").trim() !== ""
        );

    const placeId =
        matchedResult?.place_id || null;

    if (placeId) {
        barangayPlaceCache.set(cacheKey, {
            placeId,
            expiresAt:
                Date.now() + CACHE_DURATION
        });
    }

    return placeId;
}


/**
 * GET /api/address/search
 *
 * Examples:
 * /api/address/search?text=Rizal&barangay=Balintawak&city=Lipa%20City&province=Batangas
 */
router.get("/search", async (req, res) => {
    try {
        const text =
            String(req.query.text || "").trim();

        const barangay =
            String(req.query.barangay || "").trim();

        const city =
            String(req.query.city || "").trim();

        const province =
            String(req.query.province || "").trim();

        if (text.length < 2) {
            return res.json({
                results: []
            });
        }

        const searchText =
           `${text}, ${barangay}, ${city}, ${province}, Philippines`;

        const params = new URLSearchParams({
            text: searchText,
            filter: "countrycode:ph",
            limit: "20",
            format: "json",
            apiKey: GEOAPIFY_API_KEY
        });

        const response = await geoapifyRequest(
            `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`
        );

        let results = response.results || [];

        console.log(
            "Raw Geoapify results:",
            results.length,
            results.slice(0, 3)
        );

        const normalizeSearchText = (value) => {
            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[.,()-]/g, " ")
                .replace(/\s+/g, " ");
        };
        
        const streetSuffixes = [
            "street",
            "st",
            "road",
            "rd",
            "avenue",
            "ave",
            "boulevard",
            "blvd",
            "drive",
            "dr",
            "lane",
            "ln",
            "highway",
            "hwy"
        ];
        
        const typedTokens = normalizeSearchText(text)
            .split(" ")
            .filter(Boolean)
            .filter(token => !streetSuffixes.includes(token));
        
        results = results.filter(result => {
            const candidateText = normalizeSearchText(
                [
                    result.street,
                    result.name,
                    result.suburb,
                    result.district,
                    result.village,
                    result.city_district,
                    result.address_line2,
                    result.formatted
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        
            if (!candidateText || typedTokens.length === 0) {
                return false;
            }
        
            return typedTokens.every(token =>
                candidateText.includes(token)
            );
        });

        console.log(
            "After street filter:",
            results.length,
            results.map(result => ({
                street: result.street,
                name: result.name,
                suburb: result.suburb,
                city: result.city,
                state: result.state
            }))
        );

        /*
         * Normalize a location name for comparison.
         * This handles cases such as:
         * "Lipa City" vs "Lipa"
         */
        function normalizeLocation(value) {
            return String(value || "")
                .trim()
                .toLowerCase()
                .replace(/[.,()'-]/g, " ")
                .replace(/\s+/g, " ")
                .replace(/\bcity\b/g, "")
                .replace(/\bmunicipality\b/g, "")
                .replace(/\s+/g, " ")
                .trim();
        }

        const selectedBarangay =
            normalizeLocation(barangay);

        const selectedCity =
            normalizeLocation(city);

        const selectedProvince =
            normalizeLocation(province);

        /*
         * Filter results using the administrative information
         * returned by Geoapify.
         */
        if (barangay && city && province) {
            results = results.filter(result => {
                const resultCity =
                    normalizeLocation(result.city);

                const resultProvince =
                    normalizeLocation(result.state);

                const cityMatches =
                    resultCity === selectedCity ||
                    resultCity.includes(selectedCity) ||
                    selectedCity.includes(resultCity);

                const provinceMatches =
                    resultProvince === selectedProvince ||
                    resultProvince.includes(selectedProvince) ||
                    selectedProvince.includes(resultProvince);

                /*
                 * Geoapify may place the barangay/locality
                 * in different fields depending on the result.
                 */
                const localityText = [
                    result.suburb,
                    result.district,
                    result.village,
                    result.city_district,
                    result.county,
                    result.address_line2,
                    result.formatted
                ]
                    .filter(Boolean)
                    .map(normalizeLocation)
                    .join(" ");

                const barangayMatches =
                    localityText.includes(selectedBarangay);

                return (
                    cityMatches &&
                    provinceMatches &&
                    barangayMatches
                );
            });

            console.log(
                "After location filter:",
                results.length
            );
        }

        return res.json({
            results
        });

    } catch (error) {
        console.error(
            "Address autocomplete error:",
            error
        );

        return res.status(500).json({
            results: [],
            error:
                "Unable to search addresses."
        });
    }
});

router.get("/psgc-test", async (req, res) => {
    try {
        const token = process.env.PSA_PSGC_TOKEN;

        if (!token) {
            return res.status(500).json({
                success: false,
                message: "PSA PSGC token is not configured."
            });
        }

        const params = new URLSearchParams({
            reg: "4",
            prv: "10",
            mun: "14",
            token: token
        });

        const response = await fetch(
            `https://classification.psa.gov.ph/psgc/Q2_2024/barangays?${params.toString()}`
        );

        const data = await response.json();

        return res.status(response.status).json(data);

    } catch (error) {
        console.error("PSA PSGC test error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to connect to PSA PSGC API."
        });
    }
});

router.get("/barangay-test", async (req, res) => {
    try {
        const barangay = String(req.query.barangay || "").trim();
        const city = String(req.query.city || "").trim();
        const province = String(req.query.province || "").trim();

        const params = new URLSearchParams({
            text: `${barangay}, ${city}, ${province}, Philippines`,
            filter: "countrycode:ph",
            limit: "10",
            format: "json",
            apiKey: process.env.GEOAPIFY_API_KEY
        });

        const response = await fetch(
            `https://api.geoapify.com/v1/geocode/search?${params.toString()}`
        );

        const data = await response.json();

        res.status(response.status).json(data);

    } catch (error) {
        console.error("Barangay test error:", error);

        res.status(500).json({
            error: "Unable to test Barangay lookup."
        });
    }
});

router.get("/street-test", async (req, res) => {
    try {
        const placeId =
            "51c466dbc4244a5e4059da2736d549e82b40f00103f9019dce20a800000000c0020592030a42616c696e746177616b";

        const params = new URLSearchParams({
            text: "Rizal",
            filter: `place:${placeId}`,
            limit: "5",
            format: "json",
            apiKey: process.env.GEOAPIFY_API_KEY
        });

        const response = await fetch(
            `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`
        );

        const data = await response.json();

        return res.status(response.status).json(data);

    } catch (error) {
        console.error("Street test error:", error);

        return res.status(500).json({
            error: "Unable to test street search."
        });
    }
});

module.exports = router;