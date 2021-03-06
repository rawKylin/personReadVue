export default function bind (el: ASTElement, dir: ASTEDirective){
    el.wrapData = (code: string) => {//code的来源？
      return `_b(${code},'${el.tag}',${dir.value},${
        dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
      }${
        dir.modifiers && dir.modifiers.sync ? 'true' : ''
      })`
    }
}