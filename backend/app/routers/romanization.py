from fastapi import APIRouter, HTTPException, Body
from app.models.schemas import RomanizationRequest, RomanizationResponse
from app.services.romanization_service import RomanizationService

router = APIRouter()
romanization_service = RomanizationService()


@router.post("/convert", response_model=RomanizationResponse)
async def romanize_text(request: RomanizationRequest):
    """
    Convert text to romanized form based on language
    """
    try:
        romanized_text = await romanization_service.romanize_text(
            text=request.text,
            language=request.language
        )

        return RomanizationResponse(
            original_text=request.text,
            romanized_text=romanized_text,
            language=request.language
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Romanization failed: {str(e)}")


@router.post("/detect-and-convert")
async def detect_and_romanize(text: str = Body(..., embed=True)):
    """
    Auto-detect language and romanize text
    """
    try:
        # Detect language
        detected_language = romanization_service.detect_language(text)

        # Romanize if needed
        if detected_language in ["chinese", "japanese", "korean"]:
            romanized_text = await romanization_service.romanize_text(text, detected_language)
            return {
                "original_text": text,
                "romanized_text": romanized_text,
                "detected_language": detected_language
            }
        else:
            return {
                "original_text": text,
                "romanized_text": text,
                "detected_language": detected_language,
                "message": "No romanization needed for this language"
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection and romanization failed: {str(e)}")
