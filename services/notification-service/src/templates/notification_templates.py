"""Notification templates for Steer & Skill events."""

from dataclasses import dataclass


@dataclass
class NotificationTemplate:
    title: str
    body: str


TEMPLATES = {
    "steer.goal.created": NotificationTemplate(
        title="New Steer Goal Created",
        body="A new strategic AI goal '{title}' has been added to your organization.",
    ),
    "steer.goal.activated": NotificationTemplate(
        title="Steer Goal Activated",
        body="'{title}' is now active. Track progress in the Rambot app.",
    ),
    "steer.goal.overdue": NotificationTemplate(
        title="Steer Goal Overdue",
        body="'{title}' has passed its target date. Review and update the goal.",
    ),
    "skill.created": NotificationTemplate(
        title="New Skill Added",
        body="'{name}' has been added to the AI skill catalog.",
    ),
    "skill.deployed": NotificationTemplate(
        title="Skill Deployed",
        body="'{name}' is now live and available for use across your organization.",
    ),
    "skill.gap.identified": NotificationTemplate(
        title="Skill Gap Identified",
        body="AI analysis found {count} skill gaps impacting your strategic goals.",
    ),
}


def render(event_type: str, **kwargs) -> NotificationTemplate | None:
    template = TEMPLATES.get(event_type)
    if not template:
        return None
    return NotificationTemplate(
        title=template.title.format(**kwargs),
        body=template.body.format(**kwargs),
    )
