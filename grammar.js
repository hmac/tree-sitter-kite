const parens = (...rule) => seq('(', ...rule, ')');
const brackets = (...rule) => seq('[', ...rule, ']');

// sep_by("," $.ident) parses:
//    <nothing>
//    a
//    a,
//    a, b
//    a, b,
const sep_by = (separator, ...rule) => optional(sep_by1(separator, ...rule));
// sep_by1("," $.ident) parses:
//    a
//    a, b
//    a, b,
const sep_by1 = (separator, ...rule) => seq(...rule, repeat(seq(separator, ...rule)), optional(separator));
// sep_by2("," $.ident) parses:
//    a, b
//    a, b,
//    a, b, c
const sep_by2 = (separator, ...rule) => seq(...rule, separator, ...rule, repeat(seq(separator, ...rule)), optional(separator));

const comma_sep = (...rule) => sep_by1(",", ...rule);

const block = (...rule) => seq("{", ...rule, "}");

module.exports = grammar({
  name: "kite",
  extras: $ => [
    normalize(/\s/), // whitespace
    $.comment
  ],
  rules: {
    module: $ => seq("module", $.module_ident, repeat($._import), repeat($._def)),

    // Comments
    // # foo
    comment: $ => seq("#", /.*/),

    // Names
    // All names must start with a letter and contain only alphanumerics and '_'.

    // A name that starts with a lowercase letter
    _lower_ident: $ => /[a-z_][A-Za-z0-9_]*/,

    // A name that starts with an uppercase letter
    _upper_ident: $ => /[A-Z][A-Za-z0-9_]*/,

    // A series of upper idents separated by dots
    _qual_upper_ident: $ => /[A-Z][A-Za-z0-9_]*(\.[A-Z][A-Za-z0-9_]*)*/,

    // Keywords
    // https://tree-sitter.github.io/tree-sitter/creating-parsers#keyword-extraction
    word: $ => $._lower_ident,

    ident: $ => $._lower_ident,
    ctor_ident: $ => $._upper_ident,
    module_ident: $ => $._qual_upper_ident,

    // Package names are more restrictive. They can only contain lowercase letters, numbers and '-'.
    // They must start with a letter.
    pkg_ident: $ => /[a-z][a-z0-9-]*/,

    // Imports
    // [from <pkg>] import [qualified] <module_ident> [{<ctor_ident>[{* | <ctor_ident>, ...}] | <ident>, ...}] [as <module_ident>]
    _import: $ => choice($.import_from, $.import),
    import_from: $ => seq("from", $.pkg_ident, $._import_rest),
    import: $ => $._import_rest,
    _import_rest: $ => seq("import", optional($.import_qualified), $.module_ident, optional($.import_list), optional($.import_alias)),
    import_qualified: $ => "qualified",
    import_list: $ => block(comma_sep($._import_list_item)),
    _import_list_item: $ => choice($.import_type, $.import_val),
    import_type: $ => seq($.ctor_ident, optional(block(choice($.import_type_all, comma_sep($.ctor_ident))))),
    import_type_all: $ => "*",
    import_val: $ => $.ident,
    import_alias: $ => seq("as", $.module_ident),

    _def: $ => choice($.val_def, $.type_def, $.type_alias),
    val_def: $ => seq($.ident, ":", $._type, block($._expr), optional($.where)),
    type_def: $ => seq("type", $.ctor_ident, optional($.type_params), block(optional(comma_sep($.ctor_def)))),
    ctor_def: $ => seq($.ctor_ident, repeat($._atype)),
    type_params: $ => repeat1($.ident),
    where: $ => seq("where", block(repeat($.val_def))),

    // Type aliases
    type_alias: $ => seq("type alias", $.ctor_ident, optional($.type_params), block($._type)),

    // All types
    _type: $ => choice($._atype, $.func_type, $.app_type),

    // All types, excluding function types and applications, which must be parenthesised.
    _atype: $ => choice($.record_type, $.list_type, $.ctor_type, $.var_type, $.ctor_type, parens($._type)),

    record_type: $ => brackets(choice(":", comma_sep($.record_type_pair))),
    record_type_pair: $ => seq($.ident, ":", $._type),

    list_type: $ => brackets($._type),
    // Type constructor arguments must be parenthesised if they are function types
    app_type: $ => prec.left(2, seq($._atype, repeat1($._atype))),
    func_type: $ => prec.right(1, seq($._type, "->", $._type)),
    ctor_type: $ => $.ctor_ident,
    var_type: $ => $.ident,

    // All expressions
    _expr: $ => choice($._aexpr, $._infix, $.app),

    // All expressions, excluding applications, which must be parenthesised
    _aexpr: $ => choice(
      $.match,
      $.ctor,
      $.let,
      $.var,
      $.list,
      $.record,
      $.record_projection,
      $.tuple,
      $.int,
      parens($._expr)),

    app: $ => prec.left(1, seq($._aexpr, repeat1($._aexpr))),
    ctor: $ => $.ctor_ident,
    var: $ => $.ident,
    list: $ => seq("[", optional(comma_sep($._expr)), "]"),
    int: $ => /[0-9]+/,

    // Infix operators
    // + - * / ::
    _infix: $ => choice($.plus, $.minus, $.mul, $.div, $.cons),
    plus: $ => prec.left(2, seq($._expr, "+", $._expr)),
    minus: $ => prec.left(2, seq($._expr, "-", $._expr)),
    mul: $ => prec.left(3, seq($._expr, "*", $._expr)),
    div: $ => prec.left(3, seq($._expr, "/", $._expr)),
    cons: $ => prec.right(1, seq($._expr, "::", $._expr)),

    // Tuples
    // (,)
    // (,1)
    // (,1,2)
    tuple: $ => parens(seq(",", sep_by(",", $._expr))),

    // Records
    record: $ => seq("[", choice(":", comma_sep($.record_pair)), "]"),
    record_pair: $ => seq($.ident, ":", $._expr),

    // Record projection
    record_projection: $ => seq($._aexpr, $._record_projection),
    _record_projection: $ => token.immediate(/\.[_a-z0-9][A-Za-z0-9_]*/),

    // Let expressions
    let: $ => seq("let", comma_sep($.let_pair), block($._expr)),
    let_pair: $ => seq($.ident, optional(seq(":", $._type)), "=", $._expr),

    // Match expressions
    match: $ => seq("match", block(comma_sep($.match_branch))),
    match_branch: $ => seq($.pattern_group, "->", $._expr),
    pattern_group: $ => seq(repeat(seq($._pattern, ",")), $._pattern),

    // Patterns
    _pattern: $ => choice(
      $.ctor_pattern,
      $.wildcard_pattern,
      $.list_pattern,
      $.cons_pattern,
      $.var_pattern,
      $.unit_pattern,
      $.tuple_pattern,
      $.int,
    ),
    ctor_pattern: $ => prec.left(2, seq($.ctor, repeat($._pattern))),
    wildcard_pattern: $ => "_",
    list_pattern: $ => seq("[", optional(comma_sep($._pattern)), "]"),
    cons_pattern: $ => prec.right(1, seq($._pattern, "::", $._pattern)),
    var_pattern: $ => $.ident,
    unit_pattern: $ => seq("(", ",", ")"),
    tuple_pattern: $ => seq("(", comma_sep($._pattern), ")"),
  }
});
