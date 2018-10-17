import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'

type TransformFunction = (el: ASTElement, code: string) => string;
type DataGenFunction = (el: ASTElement) => string;
type DirectiveFunction = (el: ASTElement, dir: ASTDirective, warn: Function) => boolean;

export class CodegenState {
    options: CompilerOptions;
    warn: Function;
    transforms: Array<TransformFunction>;
    dataGenFns: Array<DataGenFunction>;
    directives: { [key: string]: DirectiveFunction };
    maybeComponent: (el: ASTElement) => boolean;
    onceId: number;
    staticRenderFns: Array<string>;

    constructor (options: CompilerOptions) {
        this.options = options
        this.warn = options.warn || baseWarn
        this.transforms = plunkModuleFunction(options.modules, 'transformCode')
        this.dataGenFns = plunkModuleFunction(options.modules, 'genData')
        this.directives = extend(extend({}, baseDirectives), options.directives)
        const isReservedTag = options.isReservedTag || no
        this.maybeComponent = (el: ASTElement) => !isReservedTag(el.tag)
        this.onceId = 0
        this.staticRenderFns = []
    }
}

export type CodegenResult = {
    render: string,
    staticRenderFns: Array<string>
}

export function generate(
    ast: ASTElement | void,
    options: CompilerOptions
): CodegenResult {
    const state = new CodegenState(options)
    const code = ast ? genElement(ast, state) : '_c("div")'
    return {
        render: `with(this){return ${code}}`,
        staticRenderFns: state.staticRenderFns
    }
}
export function genElement (el: ASTElement, state: CodegenState): string {
    if (el.staticRoot && !el.statocProcessed) {
        return genStatic(el, state)
    } else if (el.once && !el.onceProcessed) {
        return genOnce(el, state)
    } else if (el.for && !el.forProcessed){
        return genFor(el, state)
    } else if (el.if && !el.ifProcessed) {
        return genIf(el, state)
    } else if (el.tag === 'template' && !el.slotTarget) {
        return genChildren(el, state)|| 'void 0'
    } else if (el.tag === 'slot') {
        return genSlot(el, state)
    } else {
        let code
        if (el.component) {
            code = genComponent(el.component, el, state)
        } else {
            const data = el.plain ? undefined : genData(el, state)

            const children = el.inlineTemplate ? null : genChildren(el, state, true)
            code = `_c('${el.tag}'${data ? `,${data}` : ''
                }${
                    children ? `,${children}` : ''
                })`
        }

        for (let i = 0; i < state.transforms.length; i++) {
            code = state.transforms[i](el, code)
        }
        return code
    }
}

function genStatic(el: ASTElement, state: CodegenState): string {
    el.staticProcessed = true
    state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)
    return `_m(${
    state.staticRenderFns.length - 1
    }${
        el.staticInFor ? ',true' : ''
    })`
}
function genOnce(el: ASTElement, state: CodegenState): string {
    el.onceProcessed = true
    if (el.if && !el.ifProcessed) {
        return genIf(el, state)
    } else if (el.staticInFor) {
        let key = ''
        let parent = el.parent
        while (parent) {
            if(parent.for){
                key = parent.key
                break
            }
            parent = parent.parent
        }
        if(!key){
            process.env.NODE_ENV !== 'production' && state.warn(
                `v-once can only be use inside v-for that is keyed.`
            )
            return genElement(el, state)
        }
        return `_o(${genElement(el, state)},${state.onceId++},${key})`
    } else {
        genStatic(el, state)
    }
}
export function genIf(
    el: any,
    state: CodegenState,
    altGen?: Function,
    altEmpty?: string
):string {
    if(!conditions.length){
        return altEmpty || '_e()'
    }

    const condition = conditions.shift()
    if(condition.exp){
        return `(${condition.exp})?${
            genTernaryExp(condition.block)
            }:${
            genIfConditions(conditions, state, altGen, altEmpty)
            }`
    } else {
        return `${genTernaryExp(condition.block)}`
    }

    function genTernaryExp(el) {
        return altGen
            ? altGen(el, state)
            : el.once
            ? genOnce(el, state)
            : genElement(el, state)
    }
}

export function genFor(
    el: any,
    state: CodegenState,
    altGen?: Function,
    altHelper?: string
):string {
    const exp = el.for
    const alias = el.alias
    const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''
    const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''

    if(process.env,NODE_ENV !== 'production' && state.maybeComponent(el) && el.tah !== 'slot' && el.tag !== 'template' && !el.key){
        state.warn(
            `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
            `v-for should have explicit keys. `,
            true
        )
    }
    el.forProcessed = true
    return `${altHelper || '_l'}((${exp}),` +
        `function(${alias}${iterator1}${iterator2}){` +
        `return ${(altGen || genElement)(el, state)}` +
        '})'
}

export function genData(el: ASTElement, state: CodegenState):string {
    let data = '{'

    const dirs = genDirectives(el, state)
    if(dirs) data += dirs + ','
    if(el.key){
        data += `key:${el.key},`
    }
    if(el.ref){
        data += `ref:${el.ref},`
    }
    if(el.refInFor){
        data += `refInFor:true`
    }
    if(el.pre){
        data += `pre:true`
    }
    if(el.component){
        data += `tag:"${el.tag}",`
    }
    for(let i =0; i < state.dataGenFns.length; i++){
        data += state.dataGenFns[i](el)
    }
    if(el.attrs){
        data += `attrs:{${genProps(el.attrs)}},`
    }
    if(el.props){
        data += `domProps:{${genProps(el.props)},`
    }
    if(el.events){
        data += `${genHandlers(el.events, false, state.warn)},`
    }
    if(el.nativeEvents){
        data += `${genHandlers(el.nativeEvents, true, state.warn)},`
    }
    if(el.slotTarget && !el.slotScope){
        data += `${genScopedSlots(el.scopedSlots, state)},`
    }
    if(el.model){
        data += `model:{value:${
            el.model.value 
            },callback:${
            el.model.callback
            },expression:${
            el.model.expression
            }    
        },`
    }
    if(el.inlineTemplate){
        const inlineTemplate = genInlineTemplate(el, state)
        if(inlineTemplate){
            data += `${inlineTemplate},`
        }
    }
    data = data.replace(/,$/, '') + '}'

    if(el.wrapData){
        data = el.wrapData(data)
    }

    if(el.wrapListeners){
        data = el.wrapListeners(data)
    }
    return data
}

function genDirectives(el: ASTElement, state: CodegenState): string | void {
    const dirs = el.directives
    if(!dirs) return
    let res = 'directives:['
    let hasRuntime = false
    let i, l, dir, needRuntime
    for(i=0, l=dirs.length;i<l;i++){
        dir = dirs[i]
        needRuntime = true
        const gen: DirectiveFunction = state.directives[dir.name]
        if(gen){
            needRuntime = !!gen(el, dir, state.warn)
        }
        if(needRuntime){
            hasRuntime = true
            res += `{name:"${dir.value}",rawName:"${dir.rawName}"${
                dir.value ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}` : ''
                }${
                dir.arg ? `,arg:"${dir.arg}"` : ''
                }${
                dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
                }},`
        }
    }
    if(hasRuntime){
        return res.slice(0, -1) + ']'
    }
}
function genInlineTemplate(el: ASTElement, state: CodegenState): ?string {
    const ast = el.children[0]

}