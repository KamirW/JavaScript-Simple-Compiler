/**
 * 
 * @param {String} input 
 * @returns tokens -> an array of objects that represent each character
 * in the input as well as the value they hold
 */
function tokenizer(input) {
    const whitespace = /\s/;
    const numbers = /[0-9]/;
    const letters = /[a-z]/i;

    let currentPos = 0;
    let tokens = [];
    
    // Traverse through the input to assign tokens
    while(currentPos < input.length) {
        let char = input[currentPos];

        // Catch specific characters 
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

        // Throw error when no token can be made with the given input
        throw new TypeError('Unrecognized character: ' + char);
    }

    return tokens;
}

/**
 * 
 * @param {Array} tokens 
 * @returns AST (a tree structure made from the tokens array)
 */
function parser(tokens) {
    let currentPos = 0;

    function walk() {
        // Track the current token in the list
        let token = tokens[currentPos];

        // Parse literals first as they take no additional logic
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
            // Capture the next token so we can use that value as the calling function
            token = tokens[++currentPos];

            let node = {
                type: 'CallExpression',
                name: token.value, // The calling function
                params: [],        // Function parameters
            };

            token = tokens[++currentPos];

            while((token.type !== 'paren') || (token.type === 'paren' && token.value !== ')')) {
                // Recursively add the parameters to the node using predefined logic
                node.params.push(walk());

                // No need to increment token as it is done before loop
                token = tokens[currentPos];
            }

            // When ")" is found, we need to increment token to add to AST
            currentPos++;

            return node;
        }

        // In the case that our logic doesn't handle a specific condition
        throw new TypeError(token.type);
    }

    // Define the general shape of the AST
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