import os

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
torch.set_num_threads(1)

from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
from taglid.lid import lang_identify, simplify
import wordninja
import re

# ==========================================================
# FLASK APP
# ==========================================================

app = Flask(__name__)


# ==========================================================
# LOAD SENTENCE TRANSFORMER MODEL
# ==========================================================

print("Loading Sentence Transformer model...")

model = SentenceTransformer(
    "sentence-transformers/paraphrase-MiniLM-L3-v2",
    device="cpu"
)

print("Sentence Transformer model loaded!")
print(
    "Embedding dimension:",
    model.get_sentence_embedding_dimension()
)


# ==========================================================
# TEXT NORMALIZATION
# ==========================================================
def normalize_text(text):
    """
    Normalize text formatting by removing surrounding
    whitespace, collapsing excessive spaces, and
    standardizing capitalization.
    """

    text = str(text or "")

    text = text.strip()

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    text = text.lower()

    return text.strip()
# ==========================================================
# WORD EXTRACTION
# ==========================================================

def get_words(text):
    """
    Extract words from the text.

    Supports Unicode characters and apostrophes.
    """

    return re.findall(
        r"\b\w+(?:['’]\w+)?\b",
        text,
        flags=re.UNICODE
    )


def count_words(text):
    """
    Count words in the text.
    """

    return len(
        get_words(text)
    )


# ==========================================================
# TAGLID LANGUAGE DETECTION
# ==========================================================

def get_taglid_results(text):
    """
    Run TagLID on the complete text.

    TagLID is used for English, Tagalog, and Taglish
    language identification.

    No manually hard-coded English or Tagalog vocabulary
    is used.
    """

    try:

        labeled_text = lang_identify(
            text
        )

        simplified_text = simplify(
            labeled_text
        )

        return simplified_text

    except Exception as e:

        print(
            "TagLID error:",
            e
        )

        return []


def get_language_counts(text):
    """
    Count English and Tagalog words detected by TagLID.
    """

    results = get_taglid_results(
        text
    )

    language_counts = {
        "eng": 0,
        "tgl": 0
    }

    for item in results:

        if not isinstance(
            item,
            (tuple, list)
        ):
            continue

        if len(item) < 2:
            continue

        language = str(
            item[1]
        ).lower()

        if language == "eng":

            language_counts["eng"] += 1

        elif language == "tgl":

            language_counts["tgl"] += 1

    return language_counts


def is_taglish(text):
    """
    Returns True when TagLID detects both English
    and Tagalog in the same description.
    """

    language_counts = get_language_counts(
        text
    )

    return (
        language_counts["eng"] > 0
        and
        language_counts["tgl"] > 0
    )


def contains_tagalog(text):
    """
    Returns True when TagLID detects at least
    one Tagalog word.
    """

    language_counts = get_language_counts(
        text
    )

    return language_counts["tgl"] > 0


def contains_supported_language(text):
    """
    Returns True when TagLID detects at least
    one English or Tagalog word.
    """

    language_counts = get_language_counts(
        text
    )

    return (
        language_counts["eng"] > 0
        or
        language_counts["tgl"] > 0
    )


# ==========================================================
# STRUCTURAL GIBBERISH DETECTION
# ==========================================================

def is_suspicious_word(word):
    """
    Detect obviously malformed/random words using
    structural characteristics.

    This does NOT use a hard-coded English or Tagalog
    vocabulary list.
    """

    word = str(
        word or ""
    ).lower().strip()

    clean = re.sub(
        r"['’]",
        "",
        word
    )

    if not clean:
        return False

    # Very short words are not considered suspicious.
    if len(clean) <= 2:
        return False

    # ------------------------------------------------------
    # CHECK 1: Repeated characters
    # Example:
    # heyyyyyyy
    # aaaaaaaa
    # ------------------------------------------------------

    if re.search(
        r"(.)\1{3,}",
        clean
    ):
        return True

    # ------------------------------------------------------
    # CHECK 2: Repeated chunks
    # Example:
    # ababababab
    # xyzxyzxyz
    # ------------------------------------------------------

    if re.fullmatch(
        r"(.{1,3})\1{3,}",
        clean
    ):
        return True

    # ------------------------------------------------------
    # CHECK 3: Vowel ratio
    # ------------------------------------------------------

    vowels = re.findall(
        r"[aeiouyáéíóúàèìòùâêîôûäëïöü]",
        clean,
        re.IGNORECASE
    )

    vowel_ratio = (
        len(vowels) / len(clean)
    )

    # Very long word with almost no vowels.
    if (
        len(clean) >= 12
        and
        vowel_ratio < 0.20
    ):
        return True

    # Extremely long word with unusually few vowels.
    if (
        len(clean) >= 18
        and
        vowel_ratio < 0.30
    ):
        return True

    # ------------------------------------------------------
    # CHECK 4: Extremely long consonant sequence
    # ------------------------------------------------------

    if re.search(
        r"[bcdfghjklmnpqrstvwxz]{7,}",
        clean,
        re.IGNORECASE
    ):
        return True

    # ------------------------------------------------------
    # CHECK 5: Excessive character variety in a long word
    # ------------------------------------------------------

    if len(clean) >= 16:

        unique_ratio = (
            len(set(clean))
            /
            len(clean)
        )

        if unique_ratio >= 0.85:
            return True

    return False


# ==========================================================
# WHOLE TEXT GIBBERISH DETECTION
# ==========================================================

def looks_like_gibberish(text):
    """
    Determine whether the complete description appears
    to contain random or meaningless text.

    This function intentionally does NOT depend solely
    on TagLID because TagLID is a language identifier,
    not a semantic gibberish detector.
    """

    words = get_words(
        text
    )

    if not words:
        return True

    total_words = len(
        words
    )

    # ------------------------------------------------------
    # CHECK 1:
    # Individual suspicious words
    # ------------------------------------------------------

    suspicious_words = []

    for word in words:

        if is_suspicious_word(
            word
        ):
            suspicious_words.append(
                word
            )

    # If one obviously malformed long/random word exists,
    # reject the description.
    if suspicious_words:

        print(
            "Suspicious words detected:",
            suspicious_words
        )

        return True

    # ------------------------------------------------------
    # CHECK 2:
    # TagLID language recognition
    # ------------------------------------------------------

    language_counts = get_language_counts(
        text
    )

    eng_count = language_counts["eng"]
    tgl_count = language_counts["tgl"]

    supported_count = (
        eng_count
        +
        tgl_count
    )

    supported_ratio = (
        supported_count
        /
        total_words
    )

    # ------------------------------------------------------
    # If most of the text is recognized as English,
    # Tagalog, or Taglish, it is not structural gibberish.
    # ------------------------------------------------------

    if supported_ratio >= 0.60:

        return False

    # ------------------------------------------------------
    # CHECK 3:
    # Overall suspicious structure
    # ------------------------------------------------------

    structural_suspicious = 0

    for word in words:

        clean = re.sub(
            r"['’]",
            "",
            word.lower()
        )

        if len(clean) < 3:
            continue

        vowels = re.findall(
            r"[aeiouyáéíóúàèìòùâêîôûäëïöü]",
            clean,
            re.IGNORECASE
        )

        vowel_ratio = (
            len(vowels)
            /
            len(clean)
        )

        # Long words with extremely unusual vowel structure.
        if (
            len(clean) >= 10
            and
            vowel_ratio < 0.20
        ):

            structural_suspicious += 1

        # Long consonant sequence.
        elif re.search(
            r"[bcdfghjklmnpqrstvwxz]{7,}",
            clean,
            re.IGNORECASE
        ):

            structural_suspicious += 1

    suspicious_ratio = (
        structural_suspicious
        /
        total_words
    )

    # ------------------------------------------------------
    # Mostly suspicious text
    # ------------------------------------------------------

    if (
        total_words >= 8
        and
        suspicious_ratio >= 0.40
    ):

        return True

    if (
        total_words <= 7
        and
        suspicious_ratio >= 0.50
    ):

        return True

    # ------------------------------------------------------
    # Very little language recognition + suspicious
    # structure
    # ------------------------------------------------------

    if (
        supported_ratio < 0.30
        and
        suspicious_ratio >= 0.20
    ):

        return True

    return False


# ==========================================================
# SANITIZE INPUT
# ==========================================================

def sanitize_before_repair(text):
    """
    Remove unnecessary characters while preserving
    normal language characters and punctuation.
    """

    text = normalize_text(
        text
    )

    if not text:

        return ""

    # ------------------------------------------------------
    # REMOVE NUMBERS
    # ------------------------------------------------------

    text = re.sub(
        r"\d+",
        " ",
        text
    )

    # ------------------------------------------------------
    # KEEP:
    # Unicode letters
    # whitespace
    # apostrophes
    # hyphens
    # common punctuation
    # ------------------------------------------------------

    text = re.sub(
        r"[^\w\s'’\-\.,!?]",
        " ",
        text,
        flags=re.UNICODE
    )

    # ------------------------------------------------------
    # REMOVE INTERNAL HYPHENS USED AS SEPARATORS
    # Example:
    # friendly-playful
    # becomes:
    # friendly playful
    # ------------------------------------------------------

    text = re.sub(
        r"(?<=\w)-(?=\w)",
        " ",
        text
    )

    # ------------------------------------------------------
    # NORMALIZE SPACES
    # ------------------------------------------------------

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    # ------------------------------------------------------
    # REMOVE IMMEDIATE DUPLICATE WORDS
    # Example:
    # friendly friendly dog
    # becomes:
    # friendly dog
    # ------------------------------------------------------

    words = text.split()

    cleaned_words = []

    for word in words:

        if (
            cleaned_words
            and
            cleaned_words[-1].lower()
            ==
            word.lower()
        ):
            continue

        cleaned_words.append(
            word
        )

    text = " ".join(
        cleaned_words
    )

    return text.strip()


# ==========================================================
# DETERMINE WHETHER WORDNINJA IS NEEDED
# ==========================================================
def should_repair_text(text):
    """
    Determine whether the text may contain words that have
    been incorrectly joined together.

    WordNinja is skipped when TagLID detects Tagalog because
    WordNinja may incorrectly split valid Tagalog words.
    """

    # ------------------------------------------------------
    # SKIP WORDNINJA FOR TAGALOG / TAGLISH
    # ------------------------------------------------------
    if contains_tagalog(text):
        print("TagLID detected Tagalog.")
        print("WordNinja: Skipped")
        return False
    words = get_words(text)

    if not words:
        return False
    # ------------------------------------------------------
    # CHECK FOR LONG MASHED WORD
    # Example:
    # iwantafriendlydogthatlikesplaying
    # ------------------------------------------------------
    for word in words:

        clean_word = re.sub(
            r"['’]",
            "",
            word
        )
        # A very long single word may indicate that
        # multiple words were joined together.
        if len(clean_word) >= 25:

            print(
                "Possible mashed word detected:",
                word
            )
            return True
    # ------------------------------------------------------
    # CHECK FOR CAMEL CASE
    # Example:
    # friendlyPlayfulDog
    # ------------------------------------------------------
    if re.search(
        r"[a-z][A-Z]",
        text
    ):
        print(
            "Possible camel-case word detected."
        )
        return True
    # ------------------------------------------------------
    # NORMAL TEXT
    # ------------------------------------------------------
    return False

# ==========================================================
# WORDNINJA REPAIR
# ==========================================================
def repair_behavior_text(text):
    """
    Repair missing word boundaries using WordNinja.

    This function should only be called after
    should_repair_text() returns True.
    """

    text = normalize_text(
        text
    )

    if not text:

        return ""

    # ------------------------------------------------------
    # REMOVE SENTENCE PUNCTUATION TEMPORARILY
    # ------------------------------------------------------

    text = text.replace(
        ".",
        " "
    )

    text = text.replace(
        ",",
        " "
    )

    text = text.replace(
        "!",
        " "
    )

    text = text.replace(
        "?",
        " "
    )

    text = text.replace(
        ";",
        " "
    )

    text = text.replace(
        ":",
        " "
    )

    # ------------------------------------------------------
    # SEPARATE CAMEL CASE
    # ------------------------------------------------------

    text = re.sub(
        r"([a-z])([A-Z])",
        r"\1 \2",
        text
    )

    # ------------------------------------------------------
    # NORMALIZE SPACES
    # ------------------------------------------------------

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    # ------------------------------------------------------
    # WORDNINJA
    # ------------------------------------------------------

    words = wordninja.split(
        text
    )

    repaired = " ".join(
        words
    )

    repaired = re.sub(
        r"\s+",
        " ",
        repaired
    ).strip()

    return repaired


# ==========================================================
# CLEAN REPAIRED TEXT
# ==========================================================

def cleanup_repaired_text(text):

    text = normalize_text(
        text
    )

    if not text:

        return ""

    words = text.split()

    cleaned_words = []

    for word in words:

        if (
            cleaned_words
            and
            cleaned_words[-1].lower()
            ==
            word.lower()
        ):
            continue

        cleaned_words.append(
            word
        )

    return " ".join(
        cleaned_words
    ).strip()


# ==========================================================
# EMBEDDING ENDPOINT
# ==========================================================

@app.route(
    "/embedding",
    methods=["POST"]
)
def embedding():

    try:

        # --------------------------------------------------
        # READ JSON
        # --------------------------------------------------

        data = request.get_json(
            silent=True
        )

        if not data:

            return jsonify({
                "success": False,
                "message": "No data received."
            }), 400

        # --------------------------------------------------
        # GET TEXT
        # --------------------------------------------------

        text = data.get(
            "text",
            ""
        )

        text = normalize_text(
            text
        )

        if not text:

            return jsonify({
                "success": False,
                "message": "Text is required."
            }), 400

        # --------------------------------------------------
        # GENERATE EMBEDDING
        # --------------------------------------------------

        embedding_vector = model.encode(
            text,
            normalize_embeddings=False
        )

        # --------------------------------------------------
        # RETURN EMBEDDING
        # --------------------------------------------------

        return jsonify({
            "success": True,
            "embedding": embedding_vector.tolist()
        }), 200

    except Exception as e:

        print(
            "Embedding error:",
            e
        )

        return jsonify({
            "success": False,
            "message": "Unable to generate embedding."
        }), 500


# ==========================================================
# REPAIR / VALIDATION ENDPOINT
# ==========================================================

@app.route(
    "/repair",
    methods=["POST"]
)
def repair_text():

    try:

        # ==================================================
        # STEP 1
        # READ REQUEST
        # ==================================================

        data = request.get_json(
            silent=True
        )

        if not data:

            return jsonify({
                "success": False,
                "message": "No data received."
            }), 400

        text = data.get(
            "text",
            ""
        )

        # ==================================================
        # STEP 2
        # EMPTY INPUT
        # ==================================================

        if not str(text).strip():

            return jsonify({
                "success": False,
                "message":
                    "Please provide a pet preference description."
            }), 400

        # ==================================================
        # STEP 3
        # SANITIZE INPUT
        # ==================================================

        sanitized_text = sanitize_before_repair(
            text
        )

        if not sanitized_text:

            return jsonify({
                "success": False,
                "message":
                    "Please enter a meaningful pet preference description."
            }), 400

        # ==================================================
        # STEP 4
        # TAGLID
        # ==================================================

        language_counts = get_language_counts(
            sanitized_text
        )

        has_tagalog = (
            language_counts["tgl"] > 0
        )

        has_english = (
            language_counts["eng"] > 0
        )

        taglish = (
            has_tagalog
            and
            has_english
        )

        print("")
        print("========================================")
        print("TAGLID RESULT")
        print("Text:", sanitized_text)
        print(
            "English:",
            language_counts["eng"]
        )
        print(
            "Tagalog:",
            language_counts["tgl"]
        )
        print(
            "Taglish:",
            taglish
        )
        print("========================================")
        print("")

        # ==================================================
        # STEP 5
        # GIBBERISH CHECK
        #
        # IMPORTANT:
        # This happens BEFORE WordNinja.
        # ==================================================

        if looks_like_gibberish(
            sanitized_text
        ):

            return jsonify({
                "success": False,
                "message":
                    "Your description appears to contain random "
                    "or meaningless text. Please describe the "
                    "type of pet you are looking for.",
                "repaired_text":
                    sanitized_text,
                "word_count":
                    count_words(
                        sanitized_text
                    ),
                "character_count":
                    len(
                        sanitized_text
                    ),
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 6
        # OPTIONAL WORD REPAIR
        # ==================================================

        repaired_text = sanitized_text

        if should_repair_text(
            sanitized_text
        ):

            print(
                "WordNinja: Repairing text"
            )

            repaired_text = repair_behavior_text(
                sanitized_text
            )

        else:

            print(
                "WordNinja: Skipped"
            )

        # ==================================================
        # STEP 7
        # CLEANUP
        # ==================================================

        repaired_text = cleanup_repaired_text(
            repaired_text
        )

        if not repaired_text:

            return jsonify({
                "success": False,
                "message":
                    "Please enter a meaningful pet preference description."
            }), 400

        # ==================================================
        # STEP 8
        # COUNT WORDS / CHARACTERS
        # ==================================================

        words = get_words(
            repaired_text
        )

        word_count = len(
            words
        )

        character_count = len(
            repaired_text
        )

        # ==================================================
        # STEP 9
        # MINIMUM WORD COUNT
        # ==================================================

        if word_count < 5:

            return jsonify({
                "success": False,
                "message":
                    "Please provide at least 5 words.",
                "repaired_text":
                    repaired_text,
                "word_count":
                    word_count,
                "character_count":
                    character_count,
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 10
        # MINIMUM CHARACTER COUNT
        # ==================================================

        if character_count < 20:

            return jsonify({
                "success": False,
                "message":
                    "Please provide at least 20 characters.",
                "repaired_text":
                    repaired_text,
                "word_count":
                    word_count,
                "character_count":
                    character_count,
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 11
        # MAXIMUM WORD COUNT
        # ==================================================

        if word_count > 100:

            return jsonify({
                "success": False,
                "message":
                    "Please keep your description below 100 words.",
                "repaired_text":
                    repaired_text,
                "word_count":
                    word_count,
                "character_count":
                    character_count,
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 12
        # MAXIMUM CHARACTER COUNT
        # ==================================================

        if character_count > 1000:

            return jsonify({
                "success": False,
                "message":
                    "Please keep your description below "
                    "1000 characters.",
                "repaired_text":
                    repaired_text,
                "word_count":
                    word_count,
                "character_count":
                    character_count,
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 13
        # FINAL GIBBERISH CHECK
        #
        # This catches malformed text that may remain
        # after optional repair.
        # ==================================================

        if looks_like_gibberish(
            repaired_text
        ):

            return jsonify({
                "success": False,
                "message":
                    "Your description appears to contain random "
                    "or meaningless text. Please describe the "
                    "type of pet you are looking for.",
                "repaired_text":
                    repaired_text,
                "word_count":
                    word_count,
                "character_count":
                    character_count,
                "languages":
                    language_counts,
                "is_taglish":
                    taglish
            }), 400

        # ==================================================
        # STEP 14
        # UPDATE TAGLID RESULT
        #
        # Use the final text for the returned language counts.
        # ==================================================

        final_language_counts = get_language_counts(
            repaired_text
        )

        final_is_taglish = (
            final_language_counts["eng"] > 0
            and
            final_language_counts["tgl"] > 0
        )

        # ==================================================
        # STEP 15
        # GET TAGALOG / ENGLISH WORDS
        # ==================================================

        taglid_results = get_taglid_results(
            repaired_text
        )

        tagalog_words = []
        english_words = []

        for item in taglid_results:

            if not isinstance(
                item,
                (tuple, list)
            ):
                continue

            if len(item) < 2:
                continue

            word = str(
                item[0]
            )

            language = str(
                item[1]
            ).lower()

            if language == "tgl":

                tagalog_words.append(
                    word
                )

            elif language == "eng":

                english_words.append(
                    word
                )

        # ==================================================
        # STEP 16
        # SUCCESS
        # ==================================================

        return jsonify({
            "success": True,
            "repaired_text":
                repaired_text,
            "word_count":
                word_count,
            "character_count":
                character_count,
            "languages":
                final_language_counts,
            "is_taglish":
                final_is_taglish,
            "tagalog_words":
                tagalog_words,
            "english_words":
                english_words
        }), 200

    except Exception as e:

        print(
            "========================================"
        )

        print(
            "REPAIR ERROR:",
            e
        )

        print(
            "========================================"
        )

        return jsonify({
            "success": False,
            "message":
                "Unable to process your description."
        }), 500
# ==========================================================
# EMBEDDING
# ==========================================================

@app.route(
    "/embedding",
    methods=["POST"]
)
def get_embedding():
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "success":
                    False,
                "message":
                    "No data received."
            }), 400
        text = data.get(
            "text",
            ""
        )
        if not str(text).strip():
            return jsonify({
                "success":
                    False,
                "message":
                    "Text is required."
            }), 400

        # ==================================================
        # FINAL BASIC SAFETY CHECK
        # ==================================================
        text = normalize_text(text)
        if not text:
            return jsonify({
                "success":
                    False,
                "message":
                    "Text is required."
            }), 400
        # ==================================================
        # TOKEN COUNT
        # ==================================================
        encoded = model.tokenizer(
            text,
            add_special_tokens=True,
            truncation=False
        )
        token_count = len(
            encoded["input_ids"]
        )
        # ==================================================
        # MODEL TOKEN LIMIT
        # Your model has max_seq_length = 128.

        if token_count > 128:
            return jsonify({
                "success":
                    False,
                "message":
                    "Your description is too detailed for the matching model. Please shorten it.",
                "token_count":
                    token_count
            }), 400

        # ==================================================
        # GENERATE EMBEDDING
        # ==================================================
        embedding = model.encode(
            text
        ).tolist()
        # ==================================================
        # LOG
        # ==================================================
        print(
            "========================================"
        )
        print(
            "EMBEDDING TEXT:"
        )
        print(
            text
        )
        print(
            "Token count:",
            token_count
        )
        print(
            "Embedding dimensions:",
            len(embedding)
        )
        print(
            "========================================"
        )
        return jsonify({
            "success":
                True,
            "embedding":
                embedding,
            "repaired_text":
                text,
            "token_count":
                token_count
        })
    except Exception as error:
        print(
            "========================================"
        )
        print(
            "EMBEDDING ERROR"
        )
        print(
            "========================================"
        )
        print(error)
        print(
            "========================================"
        )
        return jsonify({
            "success":
                False,
            "message":
                "Unable to generate embedding."
        }), 500
# ==========================================================
# RUN FLASK
# ==========================================================
# if __name__ == "__main__":
#     app.run(
#         debug=False,
#         port=5000
#     )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )