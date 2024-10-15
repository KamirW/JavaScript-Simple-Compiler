function tokenizer(input) {
    let currentPos = 0;
    let tokens = [];
    
    let whitespace = /\s/;
    let numbers = /[0-9]/;
    let letters = /[a-z]/i;

    while(currentPos < input.length) {
        let char = input[currentPos];

        if(char === '(') {
            tokens.push({
                type: 'paren',
                value: '(',
            });
            
            currentPos++;
            continue;
        }

        if(char === ')') {
            tokens.push({
                type: 'paren',
                value: ')'
            });

            currentPos++;
            continue;
        }

        if(whitespace.test(char)) {
            currentPos++;
            continue;
        }

        if(numbers.test(char)) {
            let value = ''; 

            while(numbers.test(char)) {
                value += char;
                char = input[++currentPos];
            }

            tokens.push({
                type: 'number',
                value
            });  

            continue;
        }

        if(char === '"') {
            let value = '';
            char = input[++currentPos];

            while(char !== '"') {
                value += char;
                char = input[++currentPos];
            }

            char = input[++currentPos];

            tokens.push({
                type: 'string',
                value
            });

            continue;
        }

        if(letters.test(char)) {
            let value = '';

            while(letters.test(char)) {
                value += char;
                char = input[++currentPos];
            }

            tokens.push({
                type: 'name',
                value
            });

            continue;
        }

        throw new TypeError('Unrecognized character: ' + char);
    }

    return tokens;
}


function parser(tokens) {
    let currentPos = 0;

    function walk() {
        let token = tokens[currentPos];

        if(token.type === 'number') {
            currentPos++;

            return {
                type: 'NumberLiteral',
                value: token.value
            };
        }

        if(token.type === 'string') {
            currentPos++;

            return {
                type: 'StringLiteral',
                value: token.value,
            };
        }

        if(token.type === 'paren' && token.value === '(') {
            token = tokens[++currentPos];

            let node = {
                type: 'CallExpression',
                name: token.value,
                params: [],
            };

            token = tokens[++currentPos];

            while((token.type !== 'paren') || (token.type === 'paren' && token.value !== ')')) {
                node.params.push(walk());
                token = tokens[currentPos];
            }

            currentPos++;

            return node;
        }

        throw new TypeError(token.type);
    }

    let ast = {
        type: 'Program',
        body: [],
    };

    while(currentPos < tokens.length) {
        ast.body.push(walk());
    }

    return ast;
}


function traverser(ast, visitor) {
    function traverseArray(array, parent) {
        array.forEach(child => {
            traverseNode(child, parent);
        });
    }

    function traverseNode(node, parent) {
        let methods = visitor[node.type];

        if(methods && methods.enter) {
            methods.enter(node, parent);
        }

        switch(node.type) {
            case 'Program':
                traverseArray(node.body, node);
                break;
            
            case 'CallExpression':
                traverseArray(node.params, node);
                break;

            case 'NumberLiteral':
            case 'StringLiteral':
                break;

            default:
                throw new TypeError(node.type);
        }

        if(methods && methods.exit) {
            methods.exit(node, parent);
        }
    }

    traverseNode(ast, null);
}


function transformer(ast) {
    let newAst = {
        type: 'Program',
        body: [],
    };

    ast._context = newAst.body;

    traverser(ast, {
        NumberLiteral: {
            enter(node, parent) {
                parent._context.push({
                    type: 'NumberLiteral',
                    value: node.value,
                });
            },
        },

        StringLiteral: {
            enter(node, parent) {
                parent._context.push({
                    type: 'StringLiteral',
                    value: node.value,
                });
            },
        },

        CallExpression: {
            enter(node, parent) {
                let expression = {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: node.name,
                    },
                    arguments: [],
                };

                node._context = expression.arguments;

                if(parent.type !== 'CallExpression') {
                    expression = {
                        type: 'ExpressionStatement',
                        expression: expression,
                    };
                }

                parent._context.push(expression);
            },
        }
    });

    return newAst;
}


function codeGenerator(node) {
    switch(node.type) {
        case 'Program':
            return node.body.map(codeGenerator).join('\n');

        case 'ExpressionStatement':
            return (codeGenerator(node.expression) + ';');

        case 'CallExpression':
            return (
                codeGenerator(node.callee) + '(' + 
                node.arguments.map(codeGenerator).join(', ') + ')'
            );

        case 'Identifier':
            return node.name;

        case 'NumberLiteral':
            return node.value;

        case 'StringLiteral':
            return '"' + node.value + '"';
        
        default:
            throw new TypeError(node.type);
    }
}


function compiler(input) {
    let tokens = tokenizer(input);
    let ast = parser(tokens);
    let newAst = transformer(ast);
    let output = codeGenerator(newAst);

    return output;
}

module.exports = {
    tokenizer,
    parser,
    traverser,
    transformer,
    codeGenerator,
    compiler,
};