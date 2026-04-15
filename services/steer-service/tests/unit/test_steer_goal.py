"""
Unit tests: SteerGoal Domain Entity
Blueprint refs: BE-DS-*, BE-JWT-* adapted for Steer domain.
All tests are pure Python — no DB, no AI, no network.
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from src.domain.entities.steer_goal import (
    SteerGoal, SteerGoalStatus, SteerGoalType, SteerGoalPriority
)
from src.domain.value_objects.alignment_score import AlignmentScore


class TestSteerGoalLifecycle:
    """BE-SG: SteerGoal state machine tests."""

    def test_be_sg_001_new_goal_defaults_to_draft(self, make_goal):
        goal = make_goal()
        assert goal.status == SteerGoalStatus.DRAFT

    def test_be_sg_002_activate_draft_goal_succeeds(self, make_goal):
        goal = make_goal()
        goal.activate()
        assert goal.status == SteerGoalStatus.ACTIVE

    def test_be_sg_003_activate_already_active_goal_raises(self, make_goal):
        goal = make_goal()
        goal.activate()
        with pytest.raises(ValueError, match="Cannot activate"):
            goal.activate()

    def test_be_sg_004_complete_active_goal_succeeds(self, active_goal):
        active_goal.complete()
        assert active_goal.status == SteerGoalStatus.COMPLETED

    def test_be_sg_005_complete_draft_goal_raises(self, make_goal):
        goal = make_goal()
        with pytest.raises(ValueError, match="Only active"):
            goal.complete()

    def test_be_sg_006_activate_updates_timestamp(self, make_goal):
        goal = make_goal()
        before = goal.updated_at
        goal.activate()
        assert goal.updated_at >= before

    def test_be_sg_007_complete_updates_timestamp(self, active_goal):
        before = active_goal.updated_at
        active_goal.complete()
        assert active_goal.updated_at >= before

    def test_be_sg_008_goal_has_unique_id_by_default(self, make_goal):
        g1 = make_goal()
        g2 = make_goal()
        assert g1.id != g2.id


class TestAlignmentScoreEntity:
    """BE-AS: Alignment score update tests on SteerGoal entity."""

    def test_be_as_001_update_valid_score_succeeds(self, make_goal):
        goal = make_goal()
        goal.update_alignment_score(0.85)
        assert goal.ai_alignment_score == 0.85

    def test_be_as_002_update_score_zero_is_valid(self, make_goal):
        goal = make_goal()
        goal.update_alignment_score(0.0)
        assert goal.ai_alignment_score == 0.0

    def test_be_as_003_update_score_one_is_valid(self, make_goal):
        goal = make_goal()
        goal.update_alignment_score(1.0)
        assert goal.ai_alignment_score == 1.0

    def test_be_as_004_score_above_one_raises(self, make_goal):
        goal = make_goal()
        with pytest.raises(ValueError):
            goal.update_alignment_score(1.01)

    def test_be_as_005_negative_score_raises(self, make_goal):
        goal = make_goal()
        with pytest.raises(ValueError):
            goal.update_alignment_score(-0.01)

    def test_be_as_006_score_update_changes_timestamp(self, make_goal):
        goal = make_goal()
        before = goal.updated_at
        goal.update_alignment_score(0.7)
        assert goal.updated_at >= before


class TestOverdueDetection:
    """BE-OD: Overdue detection logic."""

    def test_be_od_001_active_past_target_is_overdue(self, overdue_goal):
        assert overdue_goal.is_overdue() is True

    def test_be_od_002_active_future_target_is_not_overdue(self, make_goal):
        goal = make_goal(target_date=datetime.utcnow() + timedelta(days=30))
        goal.activate()
        assert goal.is_overdue() is False

    def test_be_od_003_draft_past_target_is_not_overdue(self, make_goal):
        goal = make_goal(target_date=datetime.utcnow() - timedelta(days=1))
        # Draft (not activated) — should not be considered overdue
        assert goal.is_overdue() is False

    def test_be_od_004_completed_past_target_is_not_overdue(self, make_goal):
        goal = make_goal(target_date=datetime.utcnow() - timedelta(days=1))
        goal.activate()
        goal.complete()
        assert goal.is_overdue() is False

    def test_be_od_005_no_target_date_never_overdue(self, active_goal):
        active_goal.target_date = None
        assert active_goal.is_overdue() is False


class TestAlignmentScoreValueObject:
    """BE-VO: AlignmentScore value object tests."""

    def test_be_vo_001_valid_score_creates_instance(self):
        score = AlignmentScore(0.75)
        assert score.value == 0.75

    def test_be_vo_002_percentage_computed_correctly(self):
        assert AlignmentScore(0.82).percentage == 82

    def test_be_vo_003_label_excellent_above_80(self):
        assert AlignmentScore(0.85).label == "Excellent"

    def test_be_vo_004_label_good_60_to_79(self):
        assert AlignmentScore(0.65).label == "Good"

    def test_be_vo_005_label_fair_40_to_59(self):
        assert AlignmentScore(0.50).label == "Fair"

    def test_be_vo_006_label_poor_below_40(self):
        assert AlignmentScore(0.35).label == "Poor"

    def test_be_vo_007_score_above_one_raises(self):
        with pytest.raises(ValueError):
            AlignmentScore(1.5)

    def test_be_vo_008_negative_score_raises(self):
        with pytest.raises(ValueError):
            AlignmentScore(-0.1)

    def test_be_vo_009_value_object_is_immutable(self):
        score = AlignmentScore(0.75)
        with pytest.raises(Exception):
            score.value = 0.9  # frozen dataclass


class TestSuccessCriteria:
    """BE-SC: Success criteria field tests."""

    def test_be_sc_001_success_criteria_stored_correctly(self, make_goal):
        criteria = ["Accuracy >= 90%", "Latency < 200ms", "Zero downtime"]
        goal = make_goal(success_criteria=criteria)
        assert goal.success_criteria == criteria

    def test_be_sc_002_empty_criteria_allowed(self, make_goal):
        goal = make_goal(success_criteria=[])
        assert goal.success_criteria == []

    def test_be_sc_003_default_criteria_is_empty_list(self, org_id, owner_id):
        goal = SteerGoal(
            title="T", description="D",
            goal_type=SteerGoalType.OPERATIONAL,
            priority=SteerGoalPriority.LOW,
            owner_id=owner_id,
            organization_id=org_id,
        )
        assert isinstance(goal.success_criteria, list)
