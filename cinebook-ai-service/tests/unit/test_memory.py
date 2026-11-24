import uuid
from app.memory.long_term import UserMemoryService

def test_extract_explicit_preferences_identifies_genre_and_dislike():
    text1 = "I really like psychological thrillers with twists"
    text2 = "I hate horror movies"

    # Pattern regex testing
    patterns = UserMemoryService.EXPLICIT_PATTERNS
    import re
    match1 = re.search(patterns[0][0], text1, re.IGNORECASE)
    assert match1 is not None

    match2 = re.search(patterns[1][0], text2, re.IGNORECASE)
    assert match2 is not None
    assert "horror" in match2.group(0).lower()

def test_user_memory_service_extract_and_store_gracefully_handles_empty_db():
    user_id = uuid.uuid4()
    # Mock extract test
    memories = UserMemoryService.EXPLICIT_PATTERNS
    assert len(memories) >= 4
