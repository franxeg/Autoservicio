; =========================================================================
;  Inno Setup - Autoservicio (Windows x64)
;  Genera un instalador .exe a partir de la carpeta ..\release
;
;  Requisitos:
;    1) Tener Inno Setup instalado (https://jrsoftware.org/isdl.php)
;    2) Haber corrido antes:  scripts\construir-release.ps1
;    3) Compilar:  ISCC.exe packaging\instalador.iss
;       (o abrir este archivo con el Inno Setup Compiler y pulsar Compile)
;
;  El instalador copia el sistema a C:\Autoservicio, crea accesos directos
;  y ofrece iniciarlo al finalizar. La base de datos se prepara sola la
;  primera vez que se ejecuta iniciar.bat.
; =========================================================================

#define AppName "Autoservicio"
#define AppVersion "1.0"
#define SourceDir "..\release"

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Autoservicio
DefaultDirName={sd}\{#AppName}
DisableProgramGroupPage=yes
DefaultGroupName={#AppName}
OutputDir=..\dist
OutputBaseFilename=Autoservicio-{#AppVersion}-Setup
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName={#AppName}
DisableDirPage=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; Excludes: "config.env data\* logs\* backups\*"

[Dirs]
; La app escribe data\, logs\, backups\ y config.env en su propia carpeta,
; por eso damos permiso de modificacion al usuario final.
Name: "{app}";          Permissions: users-modify
Name: "{app}\data";     Permissions: users-modify
Name: "{app}\logs";     Permissions: users-modify
Name: "{app}\backups";  Permissions: users-modify

[Icons]
Name: "{group}\Iniciar Autoservicio"; Filename: "{app}\iniciar.bat"; WorkingDir: "{app}"
Name: "{group}\Detener";              Filename: "{app}\detener.bat"; WorkingDir: "{app}"
Name: "{group}\Backup ahora";         Filename: "{app}\backup.bat";  WorkingDir: "{app}"
Name: "{group}\Instrucciones (LEEME)"; Filename: "{app}\LEEME.txt"
Name: "{autodesktop}\Autoservicio";   Filename: "{app}\iniciar.bat"; WorkingDir: "{app}"

[Run]
Filename: "{app}\iniciar.bat"; Description: "Iniciar Autoservicio ahora"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
; No borrar los datos del cliente al desinstalar (por seguridad).
; Descomentar la siguiente linea si se quiere borrar TODO:
; Type: filesandordirs; Name: "{app}\data"
