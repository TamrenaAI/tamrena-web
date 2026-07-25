"""
Verifies Google ID tokens the frontend hands us after Google Sign-In. This
is the ONLY thing that establishes trust — never accept a client-asserted
email/sub without this verification.
"""

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.config import GOOGLE_OAUTH_CLIENT_ID

_google_request = google_requests.Request()


class InvalidGoogleToken(Exception):
    pass


def verify_google_id_token(token: str) -> dict:
    if not GOOGLE_OAUTH_CLIENT_ID:
        raise InvalidGoogleToken("GOOGLE_OAUTH_CLIENT_ID is not configured on this server.")
    try:
        claims = id_token.verify_oauth2_token(token, _google_request, GOOGLE_OAUTH_CLIENT_ID)
    except ValueError as exc:
        raise InvalidGoogleToken(str(exc)) from exc

    if not claims.get("email_verified", False):
        raise InvalidGoogleToken("Google account email is not verified.")

    return claims
