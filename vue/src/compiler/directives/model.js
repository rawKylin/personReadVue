export function genComponentModel(
  el: ASTElement,
  value: string,
  modifiers: ?ASTModifiers
): ? boolean{
  const { number, trim } = modifiers || {}
  const baseValueExpression = '$$v'//$$v能够取到什么值？
  let valueExpression = baseValueExpression
  if(trim){//取消空格
    valueExpression = `(typeof ${baseValueExpression} === 'string'` +
      `? ${baseValueExpression}.trim()` +//$$v.trim()
      `: ${baseValueExpression})`//$$v
  }
  if(number){//数字格式化
    valueExpression = `_n(${valueExpression})`
  }
  const assignment = genAssignmentCode(value, valueExpression)

  el.model = {
    value: `(${value})`,
    expression: `"${value}"`,
    callback: `function(${baseValueExpression}){${arguments}}`
  }
}

export function genAssignmentCode(
  value: string,
  assignment: string
): string{
  const res = parseModel(value)
  if(res.key === null){
    return `${value}=${assignment}`
  }else{
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}

let len, str, chr, index, expressionPos, expressionEndPos

type ModelParseResult = {
  exp: string,
  key: string | null
}

export function parseModel(val： string): ModelParseResult{
  len = val.length

  if(val.indexOf('[')<0 || val.lastIndexOf(']')< len -1){
    index = val.lastIndexOf('.')
    if(index >-1 ){
      return {
        exp: val.slice(0, index),
        key: '"' + val.slice(index + 1) + '"'
      }
    }else{
      return {
        exp: val,
        key: null
      }
    }
  }

  str = val
  index = expressionPos = expressionEndPos = 0

  while(!eof()){
    chr = next()
    if(isStringStart(chr)){
      parseString(chr)
    }else if(chr == 0x5B){
      parseBracket(chr)
    }
  }

  return {
    exp: val.slice(0, expressionPos),
    key: val.slice(expressionPos + 1, expressionEndPos)
  }
}

function next():number{
  return str.charCodeAt(++index)
}

function eof():boolean{
  return index >= len
}

function isStringStart(chr: number): boolean{
  return chr === 0x22 || chr === 0x27//36||39
}




