
import bibtexparser

def verify_bib(file_path):
    try:
        with open(file_path) as bibtex_file:
            bib_database = bibtexparser.load(bibtex_file)
        print(f"Success: Loaded {len(bib_database.entries)} entries from {file_path}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    verify_bib("/Users/tobiasduerschmid/Desktop/tobiasduerschmid.github.io/_bibliography/references.bib")
