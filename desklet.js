const Desklet = imports.ui.desklet;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Util = imports.misc.util;
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const UUID = "user@hko";
const DESKLET_DIR = imports.ui.deskletManager.deskletMeta[UUID].path;

imports.searchPath.push(DESKLET_DIR);
const Marknote = imports.marknote;

const _httpSession = new Soup.SessionAsync();
_httpSession.timeout = 5;

Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

function HkoDesklet(metadata, deskletId) {
    this._init(metadata, deskletId);
}

HkoDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, deskletId) {
        Desklet.Desklet.prototype._init.call(this, metadata, deskletId);
        this.configFile = DESKLET_DIR + "/metadata.json";
        this._menu.addAction("Edit Config", Lang.bind(this, function() {
            Util.spawnCommandLine("xdg-open " + this.configFile);
        }));

        this.window = new St.Bin();
        this.table = new St.Table();
        this.current_table = new St.Table();
        this.rhrread_table = new St.Table();
        this.forecast_table = new St.Table();
        this.api_table = new St.Table();
        this.container = new St.BoxLayout({vertical: true, x_align: 3});

        this.current_icon = new St.Button();
        this.current_temp_text = new St.Label();
        this.current_humi_text = new St.Label();
        this.current_uvin_text = new St.Label();
        this.current_rain_text = new St.Label();

        this.current_apig_text = new St.Label();
        this.current_apir_text = new St.Label();

        this.forecast_date = [];
        this.forecast_week = [];
        this.forecast_icon = [];
        this.forecast_temp = [];
        this.forecast_humi = [];
        for(let i = 0; i < 10; i++){
            this.forecast_date[i] = new St.Label();
            this.forecast_week[i] = new St.Label();
            this.forecast_icon[i] = new St.Button();
            this.forecast_temp[i] = new St.Label();
            this.forecast_humi[i] = new St.Label();
            this.forecast_table.add(this.forecast_date[i], {row:0, col:i});
            this.forecast_table.add(this.forecast_week[i], {row:1, col:i});
            this.forecast_table.add(this.forecast_icon[i], {row:2, col:i});
            this.forecast_table.add(this.forecast_temp[i], {row:3, col:i});
            this.forecast_table.add(this.forecast_humi[i], {row:4, col:i});
            this.forecast_date[i].style = 'text-align: center;';
            this.forecast_week[i].style = 'text-align: center;';
            this.forecast_icon[i].style = 'text-align: center;';
            this.forecast_temp[i].style = 'text-align: center;';
            this.forecast_humi[i].style = 'text-align: center;';
        }

        var row = 0;
        this.current_table.add(this.current_icon,     {row:0,col:0});
        this.current_table.add(this.current_temp_text,{row:0,col:1});
        this.current_table.add(this.rhrread_table,    {row:0,col:2});

        this.rhrread_table.add(this.current_humi_text,{row:row++,col:0});
        this.rhrread_table.add(this.current_rain_text,{row:row++,col:0});
        this.rhrread_table.add(this.current_uvin_text,{row:row++,col:0});

        this.api_table.add(this.current_apig_text, {row:0, col:0});
        this.api_table.add(this.current_apir_text, {row:1, col:0});

        this.table.add(this.current_table,  {row:0,col:0});
        this.table.add(this.api_table, {row:1,col:0});
        this.table.add(this.forecast_table, {row:2,col:0});

        this.container.add_actor(this.table);
        this.window.add_actor(this.container);
        this.setContent(this.window);
        this._set_config(metadata);

        this.parser = new Marknote.marknote.Parser();

        this._update_weather();
    },
    _set_config: function(metadata){
        let center = 'text-align: center;padding:20px 0;font-weight: 500;';
        this.current_temp_text.style = "font-size: " + metadata["d-font-size"]+";"+center;
        this.current_humi_text.style = "font-size: " + metadata["font-size"];
        this.current_uvin_text.style = "font-size: " + metadata["font-size"];
        this.current_rain_text.style = "font-size: " + metadata["font-size"];
        this.current_apig_text.style = "font-size: 16pt";
        this.current_apir_text.style = "font-size: 16pt";
    },
    _tick: function() {
        this._update_weather();
    },
    _update_weather: function(){
        global.log('update weather');
        this._update_current_weather();
        this._update_fnd();
        this._update_api();
        this._doLoop();
    },
    ////////////////////////////////////////////////////////////////////////////
    // Begin / restart the main loop, waiting for refreshSec before updating again
    _doLoop: function() {
        if(typeof this._timeoutId !== 'undefined') {
            Mainloop.source_remove(this._timeoutId);
        }
        this._timeoutId=Mainloop.timeout_add_seconds(1800, Lang.bind(this, this._update_weather));
    },
    _update_current_weather: function() {
        var that = this;
        let url = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread";
        let message = Soup.Message.new("GET", url);
        _httpSession.queue_message(message, function(session, message) {
            if (message.status_code === 200) {
                let data = JSON.parse(message.response_body.data);

                let icon_file = DESKLET_DIR + '/icons/'+ data.icon + ".png";
                let file = Gio.file_new_for_path(icon_file);
                let iconimg = St.TextureCache.get_default().load_uri_async(file.get_uri(), 120, 120);
                that.current_icon.set_child(iconimg);
                var temperature = data.temperature.data.filter(function(item) { return item.place === 'Hong Kong Observatory'; });
                var rainfall = data.rainfall.data.filter(function(item) { return item.place === 'Yau Tsim Mong'; });
                that.current_temp_text.set_text((temperature[0].value + "℃"));
                that.current_humi_text.set_text(("Humidity: " + data.humidity.data[0].value + "%"));
                that.current_rain_text.set_text(("Rainfall: " + rainfall[0].max + "mm"));
                if(data.uvindex.data.length > 0){
                    that.current_uvin_text.set_text(("UV index: " + data.uvindex.data[0].value + ", "+ data.uvindex.data[0].desc));
                }
            }
        });
    },
    _update_api: function() {
        var that = this;
        let url = 'https://www.aqhi.gov.hk/epd/ddata/html/out/aqhirss_Eng.xml';
        let message = Soup.Message.new("GET", url);
        _httpSession.queue_message(message, function(session, message) {
            if (message.status_code === 200) {
                let xml = message.response_body.data;

                let doc = that.parser.parse(xml);
                let rootElem = doc.getRootElement();
                let channel = rootElem.getChildElement("channel");
                let items = channel.getChildElements("item");
                let apis = items[0].getChildElement("description").getText().split('</p>');
                that.current_apig_text.set_text(apis[0].replace('<p>',''));                
                that.current_apir_text.set_text(apis[1].replace('<p>',''));
            }
        });
    },
    _update_fnd: function() {
        var that = this;
        let url = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd";
        let message = Soup.Message.new("GET", url);
        _httpSession.queue_message(message, function(session, message) {
            if (message.status_code === 200) {
                let data = JSON.parse(message.response_body.data);
                let weatherForecasts = data.weatherForecast;
                let i = 0;
                for(const forecast of weatherForecasts){
                    that.forecast_date[i].set_text(forecast.forecastDate.substr(4,2)+"/"+forecast.forecastDate.substr(6,2));
                    that.forecast_week[i].set_text(forecast.week.substr(0,3));
                    let icon_file = DESKLET_DIR + '/icons/'+ forecast.ForecastIcon + ".png";
                    let file = Gio.file_new_for_path(icon_file);
                    let iconimg = St.TextureCache.get_default().load_uri_async(file.get_uri(), 64, 64);
                    that.forecast_icon[i].set_child(iconimg);
                    that.forecast_temp[i].set_text(forecast.forecastMintemp.value + "-" +forecast.forecastMaxtemp.value + "℃");
                    that.forecast_humi[i].set_text(forecast.forecastMinrh.value + "-" +forecast.forecastMaxrh.value + "%");
                    i++;
                }
            }
        });
    },
    on_desklet_clicked: function(event) {
        this._update_weather();
    },
};

function main(metadata, deskletId) {
    return new HkoDesklet(metadata, deskletId);
}
