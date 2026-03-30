require 'tzinfo'
begin
  TZInfo::DataSource.get
rescue TZInfo::DataSourceNotFound
  require 'tzinfo/data'
  TZInfo::DataSource.set(:ruby)
end
