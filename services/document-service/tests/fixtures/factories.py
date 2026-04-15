"""Test data factories using factory-boy + Faker."""

import factory
from faker import Faker

fake = Faker()


class DocumentFactory(factory.Factory):
    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: str(fake.uuid4()))
    user_id = factory.LazyFunction(lambda: str(fake.uuid4()))
    filename = factory.LazyFunction(lambda: f"{fake.word()}_document.pdf")
    file_size = factory.LazyFunction(lambda: fake.random_int(min=10_240, max=5_000_000))
    page_count = factory.LazyFunction(lambda: fake.random_int(min=1, max=50))
    status = "done"
    created_at = factory.LazyFunction(lambda: fake.iso8601())


class AnalysisFactory(factory.Factory):
    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: str(fake.uuid4()))
    document_id = factory.LazyFunction(lambda: str(fake.uuid4()))
    summary = factory.LazyFunction(lambda: fake.paragraph(nb_sentences=5))
    entities = factory.LazyFunction(lambda: {
        "names": [fake.name()],
        "dates": [fake.date()],
        "clauses": [],
        "tasks": [fake.sentence()],
        "risks": [],
    })
    workflow = [{"step_number": 1, "action": "Review document", "priority": "High"}]
    model_used = "claude-sonnet-4-6"
    tokens_used = factory.LazyFunction(lambda: fake.random_int(min=500, max=4000))
    duration_ms = factory.LazyFunction(lambda: fake.random_int(min=3000, max=30_000))
