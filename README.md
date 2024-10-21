# Simple Compiler

This is a simple compiler that converts code from a Lisp formatting into a JavaScript formatting.  
For example:  

`(add 2 (subtract 4 3))`

would be converted into: 

`add(2, subtract(4, 3))`

## Limitations

Of course this applies to any code with a Lisp-like structure regardless of whether or not it is valid Lisp code.  
For example, the following code:  
`cry 10 5`

would be converted to something like:  
`cry(10, 5)`
