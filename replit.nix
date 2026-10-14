{ pkgs }: {
  deps = [ pkgs.python312 pkgs.poppler_utils pkgs.antiword
    (pkgs.tesseract.override { enableLanguages = [ "eng" "ara" ]; }) ];
}
