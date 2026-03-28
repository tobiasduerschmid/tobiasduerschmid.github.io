import bibtexparser
import sys

def verify_bib(file_path):
    try:
        with open(file_path) as bibtex_file:
            # Customizing the parser to be more verbose if needed
            parser = bibtexparser.bparser.BibTexParser(common_strings=True)
            bib_database = bibtexparser.load(bibtex_file, parser=parser)
        print(f"Success: Loaded {len(bib_database.entries)} entries from {file_path}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    path = "/Users/tobiasduerschmid/Projects/tobiasduerschmid.github.io/_bibliography/references.bib"
    verify_bib(path)
