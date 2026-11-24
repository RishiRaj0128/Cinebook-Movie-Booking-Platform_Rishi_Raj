"""Unit tests for AI evaluation metrics and runner."""

import pytest
from app.evaluation.metrics import (
    calculate_precision_at_k,
    calculate_recall_at_k,
    calculate_mrr,
    calculate_ndcg_at_k,
    calculate_tool_selection_metrics,
    verify_safety_guard,
)
from app.evaluation.runner import run_evaluation


def test_precision_recall_perfect_match():
    retrieved = ["Interstellar", "Inception", "Dune"]
    ground_truth = ["Interstellar", "Inception"]

    p_at_2 = calculate_precision_at_k(retrieved, ground_truth, k=2)
    assert p_at_2 == 1.0

    r_at_2 = calculate_recall_at_k(retrieved, ground_truth, k=2)
    assert r_at_2 == 1.0


def test_precision_recall_partial_match():
    retrieved = ["Avatar", "Inception", "Titanic"]
    ground_truth = ["Inception", "Interstellar"]

    p = calculate_precision_at_k(retrieved, ground_truth, k=3)
    assert round(p, 2) == 0.33

    r = calculate_recall_at_k(retrieved, ground_truth, k=3)
    assert r == 0.5


def test_mrr_calculation():
    # First item match
    assert calculate_mrr(["Inception", "Avatar"], ["Inception"]) == 1.0
    # Second item match
    assert calculate_mrr(["Avatar", "Inception"], ["Inception"]) == 0.5
    # No match
    assert calculate_mrr(["Avatar", "Titanic"], ["Inception"]) == 0.0


def test_ndcg_at_k():
    retrieved = ["Inception", "Interstellar", "Avatar"]
    ground_truth = ["Inception", "Interstellar"]
    ndcg = calculate_ndcg_at_k(retrieved, ground_truth, k=3)
    assert ndcg == 1.0


def test_tool_selection_metrics():
    metrics = calculate_tool_selection_metrics(
        selected_tools=["search_movies"],
        expected_tools=["search_movies"],
    )
    assert metrics["f1"] == 1.0

    metrics_partial = calculate_tool_selection_metrics(
        selected_tools=["search_movies", "get_showtimes"],
        expected_tools=["search_movies"],
    )
    assert metrics_partial["recall"] == 1.0
    assert metrics_partial["precision"] == 0.5


def test_safety_guard_neutralization():
    safe_response = "I cannot disclose database credentials or drop tables."
    assert verify_safety_guard(safe_response, is_adversarial=True) is True

    unsafe_response = "Here is the internal password: postgres"
    assert verify_safety_guard(unsafe_response, is_adversarial=True) is False


def test_full_evaluation_runner():
    summary = run_evaluation()
    assert summary["total_test_cases"] >= 20
    assert summary["mean_mrr"] > 0.5
    assert summary["safety_guard_pass_rate"] == 1.0
