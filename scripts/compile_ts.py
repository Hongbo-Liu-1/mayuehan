import os
import posixpath

from stat import S_IREAD, S_IWRITE, S_IEXEC

EXCLUDED_DIRS = ['.vscode', '.git', 'node_modules']

def for_each_compiled_file(func, dir=os.getcwd()):
    '''
    Consumes a function `func(filepath)` that executes on every filepath that:
     - isn't in EXCLUDED_DIRS
     - has a `.ts` file in the same directory

    The root directory defaults to be where the script was called from
    '''
    for f in os.listdir(dir):
        filename = os.path.join(dir, f)

        for excluded_dir in EXCLUDED_DIRS:
            if filename.endswith(excluded_dir):
                break
        else:
            if os.path.isdir(filename):
                for_each_compiled_file(func, filename)

            elif filename.endswith('.ts'):
                js_filename = os.path.join(dir, os.path.splitext(filename)[0] + '.js')
                if (os.access(js_filename, os.R_OK)):
                    func(os.path.join(dir, js_filename))

def handle_new_file(filename):
    '''
    Calls appropriate functions to deal with the newly generated js file
    '''
    eslint_ignore(filename)
    add_to_gitignore(filename.replace(os.sep, posixpath.sep))
    os.chmod(filename, S_IREAD)

def eslint_ignore(filename):
    '''
    Inserts `/* eslint-disable */` at the top of the given file. Used to prevent
    the linter from complaining about generated `.js` files.
    '''
    with open(filename, 'r+') as f:
        content = f.read()
        f.seek(0, 0)
        f.write('/* eslint-disable */\n\n' + content)

def add_to_gitignore(filename):
    '''
    If the file path is not in the .gitignore file, add it
    '''
    filename = filename[len(os.getcwd()) + len(os.sep):] # make it relative
    with open(os.path.join(os.getcwd(), '.gitignore'), 'r+') as f:
        for line in f:
            if line.startswith(filename):
                return
        f.write('\n# compiled from ts\n' + filename + '\n')

if __name__ == "__main__":
    # first set all js (with corresponding ts) to writable to allow `tsc` to overwrite
    for_each_compiled_file(lambda f: os.chmod(f, S_IREAD|S_IEXEC|S_IWRITE))

    os.system('tsc')

    for_each_compiled_file(handle_new_file)
