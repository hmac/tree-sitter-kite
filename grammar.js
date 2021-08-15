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
  rules: {
    module: $ => seq("module", $.module_ident, repeat($._import), repeat($._def)),

    // Names
    // All names must start with a letter and contain only alphanumerics and '_'.

    // A name that starts with a lowercase letter
    _lower_ident: $ => /[a-z][A-Za-z0-9_]*/,

    // A name that starts with an uppercase letter
    _upper_ident: $ => /[A-Z][A-Za-z0-9_]*/,

    ident: $ => $._lower_ident,
    ctor_ident: $ => $._upper_ident,
    module_ident: $ => $._upper_ident,

    // Package names are more restrictive. They can only contain lowercase letters, numbers and '-'.
    // They must start with a letter.
    pkg_ident: $ => /[a-z][a-z0-9-]*/,

    // Imports
    // [from <pkg>] import [open] <module_ident> [{<ctor_ident>[{* | <ctor_ident>, ...}] | <ident>, ...}] [as <module_ident>]
    _import: $ => choice($.import_from, $.import),
    import_from: $ => seq("from", $.pkg_ident, $._import_rest),
    import: $ => $._import_rest,
    _import_rest: $ => seq("import", optional($.import_open), $.module_ident, optional($.import_list), optional($.import_alias)),
    import_open: $ => "open",
    import_list: $ => block(comma_sep($._import_list_item)),
    _import_list_item: $ => choice($.import_type, $.import_val),
    import_type: $ => seq($.ctor_ident, optional(block(choice($.import_type_all, comma_sep($.ctor_ident))))),
    import_type_all: $ => "*",
    import_val: $ => $.ident,
    import_alias: $ => seq("as", $.module_ident),

    _def: $ => choice($.val_def, $.type_def),
    val_def: $ => seq($.ident, ":", $._type, block($._expr)),
    type_def: $ => seq("type", $.ctor_ident, block(optional(comma_sep($.ctor_def)))),
    ctor_def: $ => seq($.ctor_ident, repeat($._atype)),

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
    _expr: $ => choice($._aexpr, $.app),

    // All expressions, excluding applications, which must be parenthesised
    _aexpr: $ => choice($.match, $.ctor, $.let, $.var, $.list, $.record, $.tuple, $.int, parens($._expr)),

    app: $ => prec.left(1, seq($._aexpr, repeat1($._aexpr))),
    ctor: $ => $.ctor_ident,
    var: $ => $.ident,
    list: $ => seq("[", optional(comma_sep($._expr)), "]"),
    int: $ => /[0-9]+/,

    // Tuples
    // (,)
    // (,1)
    // (,1,2)
    tuple: $ => parens(seq(",", sep_by(",", $._expr))),

    // Records
    record: $ => seq("[", choice(":", comma_sep($.record_pair)), "]"),
    record_pair: $ => seq($.ident, ":", $._expr),

    // Let expressions
    let: $ => seq("let", comma_sep($.let_pair), block($._expr)),
    let_pair: $ => seq($.ident, "=", $._expr),

    // Match expressions
    match: $ => seq("match", block(comma_sep($.match_branch))),
    match_branch: $ => seq($.pattern_group, "->", $._expr),
    pattern_group: $ => seq(repeat(seq($._pattern, ",")), $._pattern),

    // Patterns
    _pattern: $ => choice($.ctor_pattern, $.wildcard_pattern, $.list_pattern, $.cons_pattern, $.var_pattern),
    ctor_pattern: $ => prec.left(2, seq($.ctor, repeat($._pattern))),
    wildcard_pattern: $ => "_",
    list_pattern: $ => seq("[", repeat($._pattern), "]"),
    cons_pattern: $ => prec.right(1, seq($._pattern, "::", $._pattern)),
    var_pattern: $ => $.ident,
  }
});
