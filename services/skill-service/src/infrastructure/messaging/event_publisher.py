"""Event Publisher — mirrors steer-service implementation for skill domain."""

import json
from abc import ABC, abstractmethod
from dataclasses import asdict

import aio_pika

from src.domain.events.skill_events import DomainEvent


class IEventPublisher(ABC):
    @abstractmethod
    async def publish(self, routing_key: str, event: DomainEvent) -> None:
        ...


class RabbitMQEventPublisher(IEventPublisher):
    def __init__(self, connection: aio_pika.abc.AbstractConnection, exchange_name: str = "rambot.events"):
        self._connection = connection
        self._exchange_name = exchange_name

    async def publish(self, routing_key: str, event: DomainEvent) -> None:
        async with self._connection.channel() as channel:
            exchange = await channel.declare_exchange(self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True)
            payload = json.dumps(asdict(event), default=str).encode()
            message = aio_pika.Message(body=payload, content_type="application/json", delivery_mode=aio_pika.DeliveryMode.PERSISTENT)
            await exchange.publish(message, routing_key=routing_key)


class InMemoryEventPublisher(IEventPublisher):
    def __init__(self):
        self.published: list[tuple[str, DomainEvent]] = []

    async def publish(self, routing_key: str, event: DomainEvent) -> None:
        self.published.append((routing_key, event))
