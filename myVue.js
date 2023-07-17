// 为vue的配置项 是一个对象
export function myVue(options) {
    this.__init(options);
}

myVue.prototype.__init = function (options) {
    this.$el = options.el; // 找到template根节点 进行编译
    this.$data = typeof options.data === "object" ? options.data : options.data();
    this.$methods = options.methods;

    proxy(this, this.$data);

    new Observer(this.$data);

    new Compiler(this)
};

// 劫持data 使 使用this.xxx也可以访问data中的数据
function proxy(target, data) {
    Object.keys(data).forEach((key) => {
        Object.defineProperty(target, key, {
            enumerable: true,
            configurable: true,
            get() {
                return data[key];
            },
            set(newValue) {
                if (newValue !== data[key]) {
                    data[key] = newValue;
                }
            },
        });
    });
}

// 深度监听 
// 如果是多层对象形式，那么需要对每个对象里面的每个key进行监听 

class Observer {

    constructor(data) {
        this.walk(data)
    }

    walk(data) {
        if (data && typeof data === "object") {
            Object.keys(data).forEach(key => {
                this.definReactive(data, key, data[key])
            })
        }
    }

    definReactive(data, key, value) {
        let deps = new Dep()
        this.walk(value)
        let that = this
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get() {
                if (Dep.target) {
                    deps.add(Dep.target)
                }
                return value;
            },
            set(newValue) {
                if (newValue !== data[key]) {
                    value = newValue;
                    // 如果设置的新值是一个对象 那么这个对象也要进行监听
                    that.walk(newValue)
                    deps.notify()  // 数据改变触发update函数 重新计算 进行视图更新
                }
            },
        });
    }
}

// 依赖收集 
// 在数据set的时候进行触发
// 在数据get的时候添加回调函数
class Dep {
    constructor() {
        this.watchers = new Set()  // 不重复数组
    }

    add(watcher) {
        if (watcher && watcher.update) this.watchers.add(watcher)
    }

    notify() {
        // set时 使用notify函数 直接执行更新函数
        if (this.watchers) {
            this.watchers.forEach(watch => watch.update())
        }
    }
}

// 执行回调函数
class Watcher {
    constructor(vm, key, cb) {
        this.vm = vm;
        this.key = key;
        this.cb = cb;
        Dep.target = this;
        this.__old = vm[key]
        Dep.target = null;
    }

    // 调用update 更新视图
    update() {
        console.log("this.key",this.key)
        let newValue = this.vm[this.key]
        this.cb(newValue)
    }

}


class Compiler {
    constructor(vm) {
        this.el = vm.$el;
        this.vm = vm;
        this.methods = vm.$methods;

        this.compile(vm.$el)
    }

    compile(el) {
        let childNodes = el.childNodes;

        Array.from(childNodes).forEach(node => {
            // 文本节点   nodeType=3 
            if (node.nodeType === 3) {
                this.compilText(node)
                // 元素节点
            } else if (node.nodeType === 1) {
                this.compileElement(node)
            }

            // 子节点
            if (node.nodeType && node.childNodes.length) this.compile(node)
        })
    }

    // 文本节点
    compilText(node) {
        // {{message}}
        let reg = /\{\{(.+?)\}\}/

        let value = node.textContent; //{{message}}  {{count}}

        if (reg.test(value)) {
            let key = RegExp.$1.trim();  // message
            node.textContent = value.replace(reg, this.vm[key])

            new Watcher(this.vm, key, val => {
                node.textContent = val
            })
        }
    }

    //元素节点
    compileElement(node) {
        if (node.attributes.length) {
            Array.from(node.attributes).forEach(attr => {
                let attrName = attr.name;
                if (attrName.startsWith("v-")) {

                    attrName = attrName.indexOf(":") > -1 ? attrName.substr(5) : attrName.substr(2)

                    let key = attr.value // message count clckHandle

                    this.update(node, key, attrName, this.vm[key])
                }
            })
        }
    }

    update(node, key, attrName, value) {
        // node 节点 
        // key 绑定的参数 message count clickHandle
        // sttrName  model 还是 on
        // key 在 data 中的结果

        if (attrName === "model") {
            node.value = value;
            
            new Watcher(this.vm, key, val => node.value = val)

            node.addEventListener("input", () => {
                this.vm[key] = node.value
            })
        } else if (attrName === "click") {
            node.addEventListener(attrName, this.methods[key].bind(this.vm))
        }
    }



}
