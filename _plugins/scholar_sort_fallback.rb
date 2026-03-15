require 'bibtex'

module BibTeX
  class Entry
    alias_method :old_get, :[]

    # This monkey-patch provides a fallback for the sortkey field.
    # If an entry does not have a sortkey specifically defined in the BibTeX file,
    # it derives one from the primary author's last name, skipping particles 
    # like 'de', 'von', etc. to ensure correct alphabetical sorting.
    def [] (field)
      val = old_get(field)
      
      # If field is sortkey and it's missing/empty, calculate a fallback
      if field.to_s == 'sortkey' && (val.nil? || val.to_s.empty?)
        authors = old_get('author')
        if authors
          # Get the first author's name string
          author_str = authors.to_s.split(/\s+and\s+/i).first
          if author_str
            # Handle "Last, First" or "First Last"
            # We assume it's normalized to "Last, First" by our previous script
            last_name_part = author_str.split(',').first.strip
            
            # Remove brackets if it's a corporate author e.g. {DORA}
            last_name_part = last_name_part.gsub(/[\{\}]/, '')
            
            parts = last_name_part.split(/\s+/)
            
            # Common particles to skip for sorting
            particles = %w[de von van der le la da di]
            
            idx = 0
            # Skip lowercase particles at the beginning
            while idx < parts.length - 1 && (particles.include?(parts[idx].downcase) || parts[idx] =~ /^[a-z]/)
              idx += 1
            end
            
            return parts[idx..-1].join(' ').upcase
          end
        end
      end
      
      val
    end
  end
end
