type FormulaNode =
  | { type: "variable"; id: string }
  | { type: "unary"; operator: "+" | "-"; value: FormulaNode }
  | {
      type: "binary";
      operator: "+" | "-" | "*" | "/";
      left: FormulaNode;
      right: FormulaNode;
    };

type FormulaToken =
  | { type: "id"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" };

export interface CompiledDimensionFormula {
  questionIds: string[];
  evaluate: (values: Record<string, number>) => number;
}

function tokenize(formula: string, knownQuestionIds: string[]): FormulaToken[] {
  const ids = [...new Set(knownQuestionIds)].sort((left, right) => right.length - left.length);
  const tokens: FormulaToken[] = [];
  let offset = 0;

  while (offset < formula.length) {
    const character = formula[offset];
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    const id = ids.find((candidate) => formula.startsWith(candidate, offset));
    if (id) {
      tokens.push({ type: "id", value: id });
      offset += id.length;
      continue;
    }
    if ("+-*/()".includes(character)) {
      tokens.push({
        type: "operator",
        value: character as "+" | "-" | "*" | "/" | "(" | ")",
      });
      offset += 1;
      continue;
    }
    throw new Error(`公式第 ${offset + 1} 个字符无效，仅支持题目 ID 和 + - * / ( )`);
  }
  return tokens;
}

class FormulaParser {
  private offset = 0;

  constructor(private readonly tokens: FormulaToken[]) {}

  parse(): FormulaNode {
    if (this.tokens.length === 0) {
      throw new Error("公式不能为空");
    }
    const result = this.parseAdditive();
    if (this.offset !== this.tokens.length) {
      throw new Error("公式结构不正确，请检查运算符和括号");
    }
    return result;
  }

  private parseAdditive(): FormulaNode {
    let node = this.parseMultiplicative();
    while (this.matchesOperator("+") || this.matchesOperator("-")) {
      const operator = this.consume().value as "+" | "-";
      node = {
        type: "binary",
        operator,
        left: node,
        right: this.parseMultiplicative(),
      };
    }
    return node;
  }

  private parseMultiplicative(): FormulaNode {
    let node = this.parseUnary();
    while (this.matchesOperator("*") || this.matchesOperator("/")) {
      const operator = this.consume().value as "*" | "/";
      node = {
        type: "binary",
        operator,
        left: node,
        right: this.parseUnary(),
      };
    }
    return node;
  }

  private parseUnary(): FormulaNode {
    if (this.matchesOperator("+") || this.matchesOperator("-")) {
      const operator = this.consume().value as "+" | "-";
      return { type: "unary", operator, value: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): FormulaNode {
    const token = this.tokens[this.offset];
    if (!token) {
      throw new Error("公式不能以运算符结尾");
    }
    if (token.type === "id") {
      this.offset += 1;
      return { type: "variable", id: token.value };
    }
    if (token.value === "(") {
      this.offset += 1;
      const node = this.parseAdditive();
      if (!this.matchesOperator(")")) {
        throw new Error("公式括号不匹配");
      }
      this.offset += 1;
      return node;
    }
    throw new Error("公式结构不正确，请检查运算符和括号");
  }

  private matchesOperator(value: FormulaToken["value"]): boolean {
    const token = this.tokens[this.offset];
    return token?.type === "operator" && token.value === value;
  }

  private consume(): FormulaToken {
    const token = this.tokens[this.offset];
    if (!token) {
      throw new Error("公式不完整");
    }
    this.offset += 1;
    return token;
  }
}

function collectQuestionIds(node: FormulaNode, result: Set<string>): void {
  if (node.type === "variable") {
    result.add(node.id);
    return;
  }
  if (node.type === "unary") {
    collectQuestionIds(node.value, result);
    return;
  }
  collectQuestionIds(node.left, result);
  collectQuestionIds(node.right, result);
}

function evaluateNode(node: FormulaNode, values: Record<string, number>): number {
  if (node.type === "variable") {
    return values[node.id] ?? 0;
  }
  if (node.type === "unary") {
    const value = evaluateNode(node.value, values);
    return node.operator === "-" ? -value : value;
  }
  const left = evaluateNode(node.left, values);
  const right = evaluateNode(node.right, values);
  if (node.operator === "+") return left + right;
  if (node.operator === "-") return left - right;
  if (node.operator === "*") return left * right;
  if (right === 0) {
    throw new Error("公式存在除以零的情况");
  }
  return left / right;
}

export function compileDimensionFormula(
  formula: string,
  knownQuestionIds: string[],
): CompiledDimensionFormula {
  if (formula.length > 500) {
    throw new Error("公式不能超过 500 个字符");
  }
  const node = new FormulaParser(tokenize(formula, knownQuestionIds)).parse();
  const questionIds = new Set<string>();
  collectQuestionIds(node, questionIds);
  if (questionIds.size === 0) {
    throw new Error("公式至少需要包含一个题目 ID");
  }
  return {
    questionIds: [...questionIds],
    evaluate(values) {
      const result = evaluateNode(node, values);
      if (!Number.isFinite(result)) {
        throw new Error("公式计算结果必须是有限数字");
      }
      return result;
    },
  };
}

export function formulaQuestionIds(
  formula: string,
  knownQuestionIds: string[],
): string[] {
  try {
    return compileDimensionFormula(formula, knownQuestionIds).questionIds;
  } catch {
    const ids = [...new Set(knownQuestionIds)].sort((left, right) => right.length - left.length);
    const result = new Set<string>();
    let offset = 0;
    while (offset < formula.length) {
      const id = ids.find((candidate) => formula.startsWith(candidate, offset));
      if (id) {
        result.add(id);
        offset += id.length;
      } else {
        offset += 1;
      }
    }
    return [...result];
  }
}

export function replaceFormulaQuestionId(
  formula: string,
  previousId: string,
  nextId: string,
  knownQuestionIds: string[],
): string {
  try {
    const tokens = tokenize(formula, knownQuestionIds);
    return tokens
      .map((token) =>
        token.type === "id"
          ? token.value === previousId
            ? nextId
            : token.value
          : token.value,
      )
      .join(" ");
  } catch {
    return formula.split(previousId).join(nextId);
  }
}

export function removeFormulaQuestionId(
  formula: string,
  removedId: string,
  knownQuestionIds: string[],
): string {
  try {
    const tokens = tokenize(formula, knownQuestionIds);
    for (let index = tokens.length - 1; index >= 0; index -= 1) {
      const token = tokens[index];
      if (!token) continue;
      if (token.type !== "id" || token.value !== removedId) continue;
      const previous = tokens[index - 1];
      const next = tokens[index + 1];
      if (
        previous?.type === "operator" &&
        ["+", "-", "*", "/"].includes(previous.value)
      ) {
        tokens.splice(index - 1, 2);
      } else if (
        next?.type === "operator" &&
        ["+", "-", "*", "/"].includes(next.value)
      ) {
        tokens.splice(index, 2);
      } else {
        tokens.splice(index, 1);
      }
    }
    return tokens.map((token) => token.value).join(" ").trim();
  } catch {
    return formula.split(removedId).join("").trim();
  }
}
