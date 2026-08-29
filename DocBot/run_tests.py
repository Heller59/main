"""
run_tests.py

Runs test_questions.json against a given version's index and flags any
answer that's missing its expected keywords. Not a substitute for human
review, but catches obvious regressions when docs or prompts change.

Usage:
    python run_tests.py --version v1.0
"""
import argparse
import json

from chatbot import answer_question


def run_tests(version: str, tests_path: str = "test_questions.json"):
    tests = json.loads(open(tests_path, encoding="utf-8").read())
    passed, failed = 0, 0

    for t in tests:
        answer, sources, images = answer_question(t["question"], version)
        lower_answer = answer.lower()
        missing = [kw for kw in t["should_mention"] if kw.lower() not in lower_answer]

        if missing:
            failed += 1
            print(f"[FAIL] {t['question']}")
            print(f"        missing: {missing}")
            print(f"        got: {answer[:200]}...\n")
        else:
            passed += 1
            print(f"[PASS] {t['question']}\n")

    print(f"\n{passed} passed, {failed} failed out of {len(tests)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--tests", default="test_questions.json")
    args = parser.parse_args()

    run_tests(args.version, args.tests)
