const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/;
//     [a-zA-Z0-9]|()=> | function (
const simplePathRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

//按键事件.keycode别名
const keyCodes: { [key: string]: number | Array<number> } = {
    esc: 27,
    tab: 9,
    enter: 13,
    space: 32,
    up: 38,
    left: 37,
    right:39,
    down: 40,
    'delete': [8,46]
}
//按键事件.key别名
const keyNames: {[key: string]: string | Array<string>} = {
    esc: 'Escape',
    tab: 'Tab',
    enter: 'Enter',
    space: ' ',
    //ie11兼容，增加前缀Arrow
    up: ['Up', 'ArrowUp'],
    left: ['Left', 'ArrowLeft'],
    right: ['Right', 'ArrowRight'],
    down: ['Down', 'ArrowDown'],
    'delete': ['Backspace', 'Delete']
}

const genGuard = condition => `if(${contdition})return null;`

const modifierCode: {[key: string]: string} = {
    stop: '$event.stopPropagation();',
    prevent: '$event.preventDefault();',
    self: genGuard(`$event.target !== $event.currentTarget`),
    ctrl: genGuard(`!$event.ctrlKey`),
    shift: genGuard(`$event.shiftKey`),
    alt: genGuard(`!$event.altKey`),
    meta: genGuard(`!$event.metaKey`),
    left: genGuard(`'button' in $event && $event.button !== 0`),
    middle: genGuard(`'button' in $event && $event.button !== 1`),
    right: genGuard(`'button' in $event && $event.button !==2`)
}

export function genHandlers (
    events: ASTElementHandlers,
    isNative: bollean,
    warn: Function
): string{
    let res = isNative ? 'nativeOn:{' : 'on:{'
    for (const name in events) {
        res += `"${name}":${genHandler(name, events[name])},`
    }
    return res.slice(0, -1) + '}'
}

function genWeexHandler(params: Array<any>, handlerCode: string){
    let innerHandlerCode = handlerCode
    const exps = params.fliter(exp => simplePathRE.test(exp) && exp !== '$event')
    const bindings = exps.map(exp => ({'@binding': exp}))
    const args = exps.map((exp, i) => {
        cosnt key = `$_${i+1}`
        innerHandlerCode = innerHandlerCode.replace(exp, key)//读不懂
        debugger
        return key

    })
    args.push('$event')
    return '{\n' +
        `handler:function(${args.join(',')}){${innerHandlerCode}},\n` +
        `params:${JSON.stringify(bindings)}\n` +
        '}'
}

function genHandler(
    name: string,
    handler: ASTElementHandler | Array<ASTElementHandler>
): string {
    if(!handler){
        return 'function(){}'
    }

    if(Array.isArray(handler)){
        return `[${handler.map(handler => genHandler(name, handler)).join(',')}]`
    }

    const isMethodPath = simplePathRE.test(handler.value)
    const isFunctionExpression = fnExpRE.test(handler.value)

    if (!handler.modifiers) {
       if (isMethodPath || isFunctionExpression) {
          return handler.vaue
       }
       if (__WEEX__ && handler.params) {
           return genWeexHandler(handler.params, handler.value)
       }
       return `function($event){${handler.value}}`
    } else {
        let code = ''
        let genModifierCode = ''
        const keys = []
        for (const key in handler.modifiers) {
            if (modifierCode[key]) {
                genModifierCode += modifierCode[key]
                // left / right
                if (keyCodes[key]) {
                    keys.push(keyCodes[key])
                }
            } else if (key === 'exact') {
                const modifiers: ASTModifiers = (handler.modifiers : any)
                genModifierCode += genGuard(
                    ['ctrl', 'shift', 'alt', 'meta']
                        .filter(keyModifier => !modifiers[keyModifier])
                        .map(keyModifier => `$event.${keyModifier}Key`)
                        .join('||')
                )
            } else {
                keys.push(key)
            }
        }
        if (keys.length) {
            code += genKeyFilter(keys)
        }

        if(genModifierCode){
            code += genModifierCode
        }
        const handleCode = isMethodPath
            ? `return ${handler.value}($event)`
            : isFunctionExpression
                ? `return (${handler.value})($event)`
                :handler.value
        if(__WEEX__ && handler.params){
            return genWeexHandler(handler.params, handler.value)
        }
        return `function($event){${code}${handleCode}}`
    }
}

function genKeyFilter (keys: Array<string>): string {
    return `if(!('button' in $event) && ${keys.map(genFilterCode).join('&&')}) return null;`
}

function genFilterCode (key: string): string {
    const keyVal = parseInt(key, 10)
    if (keyVal) {
        return `$event.keyCode !== ${keyVal}`
    }
    const keyCode = keyCodes[key]
    const keyName = keyNames[key]
    return (
        `_k($event.keyCode,` +
        `${JSON.stringify(key)},` +
        `${JSON.stringify(keyCode)},` +
        `$event.key,`
        `${JSON.stringify(keyName)}` +
        `)`
    )
}