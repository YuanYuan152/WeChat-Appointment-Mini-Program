$1 == "server_name" {
  collecting = 1
  line = $0
  if (index($0, ";")) {
    collecting = 0
  } else {
    next
  }
}

collecting {
  line = line " " $0
  if (index($0, ";")) {
    collecting = 0
  } else {
    next
  }
}

line != "" && !collecting {
  gsub(/;/, " ", line)
  count = split(line, fields, /[[:space:]]+/)
  for (field_index = 2; field_index <= count; field_index++) {
    if (fields[field_index] == target) {
      matches++
    }
  }
  line = ""
}

END {
  print matches + 0
}
