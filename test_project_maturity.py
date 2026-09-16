"""Testes de regressão do consolidador project_maturity.py para Alquimia do Saber."""

from __future__ import annotations

import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import project_maturity as maturity


class ProjectMaturityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.current = maturity.build_assessment(ROOT, strict_tools=False)

    def test_extract_json_ignores_logs_around_report(self) -> None:
        payload = maturity._extract_json('aviso\n{"nota": 88, "nivel": 4}\nlog')
        self.assertEqual(payload["nota"], 88)

    def test_stage_thresholds_are_monotonic(self) -> None:
        self.assertEqual(maturity.stage_for_score(0).level, 0)
        self.assertEqual(maturity.stage_for_score(79.9).level, 3)
        self.assertEqual(maturity.stage_for_score(80).level, 4)
        self.assertEqual(maturity.stage_for_score(92).level, 5)

    def test_current_code_reflects_maturity(self) -> None:
        assessment = self.current
        self.assertGreaterEqual(assessment.score, 88)
        self.assertGreaterEqual(assessment.raw_stage.level, 4)
        self.assertEqual(assessment.effective_stage.level, 5)
        blocker_ids = {blocker.id for blocker in assessment.blockers}
        self.assertNotIn("runtime-nao-comprovado", blocker_ids)

    def test_weights_total_one_hundred_and_ids_are_unique(self) -> None:
        self.assertEqual(sum(area.weight for area in self.current.areas), 100)
        ids = [check.id for area in self.current.areas for check in area.checks]
        self.assertEqual(len(ids), len(set(ids)))

    def test_regression_suites_are_executed(self) -> None:
        tools = {tool.name: tool for tool in self.current.tools}
        self.assertTrue(tools["backend-regression-tests"].executed)
        self.assertTrue(tools["backend-regression-tests"].report["passed"])
        self.assertTrue(tools["frontend-regression-tests"].executed)
        self.assertTrue(tools["frontend-regression-tests"].report["passed"])


if __name__ == "__main__":
    unittest.main()
