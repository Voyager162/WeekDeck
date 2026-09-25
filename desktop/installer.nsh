!macro customInit
  ; electron-builder has selected the installation scope and registry view here.
  ; Ignore stale registry entries when the installed executable is missing.
  ReadRegStr $R0 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
  ReadRegStr $R1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  ${If} $R0 == "${VERSION}"
  ${AndIf} ${FileExists} "$R1\${APP_EXECUTABLE_FILENAME}"
    MessageBox MB_OK|MB_ICONINFORMATION "Weekdeck ${VERSION} is already installed. Installation has been cancelled." /SD IDOK
    SetErrorLevel 1638
    Quit
  ${EndIf}
!macroend
