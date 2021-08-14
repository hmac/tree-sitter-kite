{ pkgs ? import <nixpkgs> { } }:
pkgs.mkShell {
  nativeBuildInputs = with pkgs; [ nodejs clang tree-sitter cargo rustc ];
}
