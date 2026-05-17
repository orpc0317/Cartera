$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Mapa de caracteres acentuados usando codepoints para evitar problemas de encoding del script
$pairs = @(
    @([char]0x00E1, 'a'), @([char]0x00E9, 'e'), @([char]0x00ED, 'i'), @([char]0x00F3, 'o'), @([char]0x00FA, 'u'),
    @([char]0x00C1, 'A'), @([char]0x00C9, 'E'), @([char]0x00CD, 'I'), @([char]0x00D3, 'O'), @([char]0x00DA, 'U'),
    @([char]0x00F1, 'n'), @([char]0x00D1, 'N'), @([char]0x00FC, 'u'), @([char]0x00DC, 'U')
)

Get-ChildItem -Path "src\app\dashboard" -Recurse -Filter "_client.tsx" | ForEach-Object {
    $p = $_.FullName
    $t = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
    $orig = $t
    foreach ($pair in $pairs) {
        $t = $t.Replace([string]$pair[0], $pair[1])
    }
    if ($t -ne $orig) {
        [System.IO.File]::WriteAllText($p, $t, $utf8NoBom)
        Write-Host "Updated: $($_.Directory.Name)/$($_.Name)"
    }
}
Write-Host "Done."
