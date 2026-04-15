"""Firebase Cloud Messaging provider for push notifications (Android + iOS)."""

from dataclasses import dataclass
import firebase_admin
from firebase_admin import credentials, messaging


@dataclass
class PushNotification:
    title: str
    body: str
    data: dict
    device_token: str


class FCMProvider:
    def __init__(self, service_account_path: str):
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)

    async def send(self, notification: PushNotification) -> str:
        message = messaging.Message(
            notification=messaging.Notification(
                title=notification.title,
                body=notification.body,
            ),
            data={str(k): str(v) for k, v in notification.data.items()},
            token=notification.device_token,
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", badge=1)
                )
            ),
        )
        response = messaging.send(message)
        return response

    async def send_multicast(self, notification: PushNotification, tokens: list[str]) -> dict:
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=notification.title, body=notification.body),
            data={str(k): str(v) for k, v in notification.data.items()},
            tokens=tokens,
        )
        response = messaging.send_each_for_multicast(message)
        return {"success_count": response.success_count, "failure_count": response.failure_count}
