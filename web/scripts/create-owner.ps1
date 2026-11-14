$staffName = Read-Host 'Имя Owner'
$staffPhone = Read-Host 'Телефон (+373...)'
$staffSecret = Read-Host 'Пароль (не менее 12 символов)' -AsSecureString
$staffPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($staffSecret)
try {
  $staffPlaintext = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($staffPointer)
  $staffPlaintext | node scripts/create-owner.mjs $staffName $staffPhone
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($staffPointer)
  $staffPlaintext = $null
}
