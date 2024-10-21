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
 * @returns Abstract Syntax Tree (AST) -> a tree structure made from the tokens array
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

/**
 * 
 * @param {Array<Object>} ast 
 * @param {Array<Object>} visitor -> has predetermined functions for certain types
 */
function traverser(ast, visitor) {
    function traverseArray(array, parent) {
        array.forEach(child => {
            traverseNode(child, parent);
        });
    }

    function traverseNode(node, parent) {
        // Testing if the type of the node matches what we handle below
        let methods = visitor[node.type];
        
        // Testing if the method exists and if we have defined an enter method in the transformer for it
        if(methods && methods.enter) {
            // Call the enter method we define in the transformer
            methods.enter(node, parent);
        }

        switch(node.type) {
            case 'Program':
                // We need to traverse through the "body" to visit each node
                traverseArray(node.body, node);
                break;
            
            case 'CallExpression':
                // We need to traverse through the "params" to visit each node
                traverseArray(node.params, node);
                break;

            // No traversing is required for literals as they have no children
            case 'NumberLiteral':
            case 'StringLiteral':
                break;

            default:
                // If our logic doesn't handle a specific type
                throw new TypeError(node.type);
        }

        // If there is an exit function, then we call it
        if(methods && methods.exit) {
            methods.exit(node, parent);
        }
    }

    // Passing null as the parent of the Program as it is the top of the tree
    traverseNode(ast, null);
}

/**
 * 
 * @param {Array<Object>} ast 
 * @returns Abstract Syntax Tree (Ast) -> tree like structure for the language we are converting into
 */
function transformer(ast) {
    // The shape of the newAst is similar to the old one
    let newAst = {
        type: 'Program',
        body: [],
    };

    // Take a reference from the old AST to the newAst
    // This allows us to easily push nodes to their parents as we are explicitly 
    // stating that the two AST's have the same shape
    ast._context = newAst.body;

    traverser(ast, {
        // First visitor method accepts Numeric Literals
        NumberLiteral: {
            enter(node, parent) {
                // Create a new node to push to the parent context
                parent._context.push({
                    type: 'NumberLiteral',
                    value: node.value,
                });
            },
        },

        // Next visitor method accepts String Literals
        StringLiteral: {
            enter(node, parent) {
                parent._context.push({
                    type: 'StringLiteral',
                    value: node.value,
                });
            },
        },

        // Next visitor accepts call expressions
        CallExpression: {
            enter(node, parent) {
                // Create a new structure for the CallExpression for the newAST
                let expression = {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: node.name,
                    },
                    arguments: [],
                };

                // Have the ability to push arguments from old AST node to newAST node
                node._context = expression.arguments;

                // If the parent isn't a CallExpression, then we wrap the call expression
                // in an ExpressionStatement. This is because CallExpression are actual statements in JS
                // so it avoids confusion
                if(parent.type !== 'CallExpression') {
                    expression = {
                        type: 'ExpressionStatement',
                        expression: expression,
                    };
                }

                // Include this new structure into the parent' context
                parent._context.push(expression);
            },
        }
    });

    return newAst;
}

/**
 * Compresses the AST into one string using recursion
 * @param {AST} node 
 * @returns String of newly generated code
 */
function codeGenerator(node) {
    switch(node.type) {
        // If it's a Program, we need to put all its children into the code generator
        case 'Program':
            return node.body.map(codeGenerator).join('\n');

        // If it's an ExpressionStatement, we need to put its expression into 
        // the code generator
        case 'ExpressionStatement':
            return (codeGenerator(node.expression) + ';');

        // For CallExpressions, we print the callee(found in the next iter)
        // as well as its arguments and put them between parentheses
        case 'CallExpression':
            return (
                codeGenerator(node.callee) + '(' + 
                node.arguments.map(codeGenerator).join(', ') + ')'
            );

        case 'Identifier':
            return node.name;

        case 'NumberLiteral':
            return node.value;

        // For strings, we just surround them in quotes
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