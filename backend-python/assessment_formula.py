"""Safe parser and evaluator for assessment dimension formulas."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence


class AssessmentFormulaError(ValueError):
    pass


@dataclass(frozen=True)
class FormulaNode:
    kind: str
    value: str
    left: "FormulaNode | None" = None
    right: "FormulaNode | None" = None


def _tokenize(formula: str, known_question_ids: Sequence[str]) -> list[tuple[str, str]]:
    if len(formula) > 500:
        raise AssessmentFormulaError("公式不能超过 500 个字符")
    ids = sorted(set(known_question_ids), key=len, reverse=True)
    tokens: list[tuple[str, str]] = []
    offset = 0
    while offset < len(formula):
        character = formula[offset]
        if character.isspace():
            offset += 1
            continue
        question_id = next(
            (item for item in ids if formula.startswith(item, offset)),
            None,
        )
        if question_id is not None:
            tokens.append(("id", question_id))
            offset += len(question_id)
            continue
        if character in "+-*/()":
            tokens.append(("operator", character))
            offset += 1
            continue
        raise AssessmentFormulaError(
            f"公式第 {offset + 1} 个字符无效，仅支持题目 ID 和 + - * / ( )"
        )
    return tokens


class _Parser:
    def __init__(self, tokens: list[tuple[str, str]]) -> None:
        self.tokens = tokens
        self.offset = 0

    def parse(self) -> FormulaNode:
        if not self.tokens:
            raise AssessmentFormulaError("公式不能为空")
        node = self._additive()
        if self.offset != len(self.tokens):
            raise AssessmentFormulaError("公式结构不正确，请检查运算符和括号")
        return node

    def _additive(self) -> FormulaNode:
        node = self._multiplicative()
        while self._matches("+") or self._matches("-"):
            operator = self._consume()[1]
            node = FormulaNode("binary", operator, node, self._multiplicative())
        return node

    def _multiplicative(self) -> FormulaNode:
        node = self._unary()
        while self._matches("*") or self._matches("/"):
            operator = self._consume()[1]
            node = FormulaNode("binary", operator, node, self._unary())
        return node

    def _unary(self) -> FormulaNode:
        if self._matches("+") or self._matches("-"):
            operator = self._consume()[1]
            return FormulaNode("unary", operator, self._unary())
        return self._primary()

    def _primary(self) -> FormulaNode:
        if self.offset >= len(self.tokens):
            raise AssessmentFormulaError("公式不能以运算符结尾")
        token_type, value = self.tokens[self.offset]
        if token_type == "id":
            self.offset += 1
            return FormulaNode("variable", value)
        if value == "(":
            self.offset += 1
            node = self._additive()
            if not self._matches(")"):
                raise AssessmentFormulaError("公式括号不匹配")
            self.offset += 1
            return node
        raise AssessmentFormulaError("公式结构不正确，请检查运算符和括号")

    def _matches(self, value: str) -> bool:
        return (
            self.offset < len(self.tokens)
            and self.tokens[self.offset] == ("operator", value)
        )

    def _consume(self) -> tuple[str, str]:
        if self.offset >= len(self.tokens):
            raise AssessmentFormulaError("公式不完整")
        token = self.tokens[self.offset]
        self.offset += 1
        return token


def parse_dimension_formula(
    formula: str,
    known_question_ids: Sequence[str],
) -> FormulaNode:
    return _Parser(_tokenize(formula, known_question_ids)).parse()


def formula_question_ids(node: FormulaNode) -> set[str]:
    if node.kind == "variable":
        return {node.value}
    if node.kind == "unary":
        return formula_question_ids(node.left) if node.left else set()
    result: set[str] = set()
    if node.left:
        result.update(formula_question_ids(node.left))
    if node.right:
        result.update(formula_question_ids(node.right))
    return result


def evaluate_dimension_formula(
    node: FormulaNode,
    values: Mapping[str, float | int],
) -> float:
    if node.kind == "variable":
        return float(values.get(node.value, 0))
    if node.kind == "unary":
        value = evaluate_dimension_formula(node.left, values) if node.left else 0.0
        return -value if node.value == "-" else value
    left = evaluate_dimension_formula(node.left, values) if node.left else 0.0
    right = evaluate_dimension_formula(node.right, values) if node.right else 0.0
    if node.value == "+":
        return left + right
    if node.value == "-":
        return left - right
    if node.value == "*":
        return left * right
    if right == 0:
        raise AssessmentFormulaError("公式存在除以零的情况")
    return left / right
