"module" @keyword
"match" @keyword
"import" @keyword
"as" @keyword
(import_qualified) @keyword
"let" @keyword
"where" @keyword

; Types (and modules)
(module (module_ident) @constructor)
(ctor_type) @constructor
(var_type) @type
(import_type (ctor_ident) @constructor)
(type_def (ctor_ident) @constructor)

; Constructors
(ctor_ident) @constructor
(ctor) @constructor

; Variables
(ident) @variable
(import_val (ident) @variable)
(var) @variable
(type_params (ident) @variable)
(var_type (ident) @variable)
