$f = Resolve-Path "src/pages/Resources.jsx"
$lines = [System.IO.File]::ReadAllLines($f)
$keep = $lines[0..2097] + $lines[2298..($lines.Length-1)]
[System.IO.File]::WriteAllLines($f, $keep)
Write-Host "Done. Lines remaining: $($keep.Length)"
