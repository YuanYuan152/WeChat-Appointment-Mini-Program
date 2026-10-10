type Node =
  | { kind: "id"; value: string }
  | { kind: "unary"; value: "+" | "-"; child: Node }
  | { kind: "binary"; value: "+" | "-" | "*" | "/"; left: Node; right: Node };

type Token = { kind: "id" | "operator"; value: string };

function tokens(formula: string, knownIds: string[]): Token[] {
  const ids = [...new Set(knownIds)].sort((a, b) => b.length - a.length);
  const result: Token[] = [];
  let offset = 0;
  while (offset < formula.length) {
    const character = formula[offset];
    if (/\s/.test(character)) {
      offset += 1;
      continue;
    }
    const id = ids.find((candidate) => formula.startsWith(candidate, offset));
    if (id) {
      result.push({ kind: "id", value: id });
      offset += id.length;
      continue;
    }
    if ("+-*/()".includes(character)) {
      result.push({ kind: "operator", value: character });
      offset += 1;
      continue;
    }
    throw new Error("维度计算公式包含无效字符");
  }
  return result;
}

class Parser {
  private offset = 0;

  constructor(private readonly values: Token[]) {}

  parse(): Node {
    if (!this.values.length) throw new Error("维度计算公式为空");
    const node = this.additive();
    if (this.offset !== this.values.length) throw new Error("维度计算公式结构错误");
    return node;
  }

  private additive(): Node {
    let node = this.multiplicative();
    while (this.matches("+") || this.matches("-")) {
      const operator = this.values[this.offset++].value as "+" | "-";
      node = { kind: "binary", value: operator, left: node, right: this.multiplicative() };
    }
    return node;
  }

  private multiplicative(): Node {
    let node = this.unary();
    while (this.matches("*") || this.matches("/")) {
      const operator = this.values[this.offset++].value as "*" | "/";
      node = { kind: "binary", value: operator, left: node, right: this.unary() };
    }
    return node;
  }

  private unary(): Node {
    if (this.matches("+") || this.matches("-")) {
      const operator = this.values[this.offset++].value as "+" | "-";
      return { kind: "unary", value: operator, child: this.unary() };
    }
    return this.primary();
  }

  private primary(): Node {
    const token = this.values[this.offset];
    if (!token) throw new Error("维度计算公式不完整");
    if (token.kind === "id") {
      this.offset += 1;
      return { kind: "id", value: token.value };
    }
    if (token.value === "(") {
      this.offset += 1;
      const node = this.additive();
      if (!this.matches(")")) throw new Error("维度计算公式括号不匹配");
      this.offset += 1;
      return node;
    }
    throw new Error("维度计算公式结构错误");
  }

  private matches(value: string): boolean {
    return this.values[this.offset]?.kind === "operator"
      && this.values[this.offset]?.value === value;
  }
}

function evaluate(node: Node, values: Record<string, number>): number {
  if (node.kind === "id") return values[node.value] ?? 0;
  if (node.kind === "unary") {
    const value = evaluate(node.child, values);
    return node.value === "-" ? -value : value;
  }
  const left = evaluate(node.left, values);
  const right = evaluate(node.right, values);
  if (node.value === "+") return left + right;
  if (node.value === "-") return left - right;
  if (node.value === "*") return left * right;
  if (right === 0) throw new Error("维度计算公式不能除以零");
  return left / right;
}

export function evaluateDimensionFormula(
  formula: string,
  knownIds: string[],
  values: Record<string, number>,
): number {
  return evaluate(new Parser(tokens(formula, knownIds)).parse(), values);
}
