module LiquidFilter
  def liquid(input)
    Liquid::Template.parse(input).render(@context)
  end
end

Liquid::Template.register_filter(LiquidFilter)
