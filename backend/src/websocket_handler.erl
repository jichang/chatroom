-module(websocket_handler).

-include("channel.hrl").

-export([init/2]).

-export([websocket_init/1, websocket_handle/2, websocket_info/2, terminate/2]).

init(Req, State) ->
    QsVals = cowboy_req:parse_qs(Req),
    {_, ChannelId} = lists:keyfind(<<"channel_id">>, 1, QsVals),
    case channel_registry_server:query(uuid:string_to_uuid(ChannelId)) of
        {ok, _} ->
            Opts = #{max_frame_size => 8000, idle_timeout => 30000},
            {cowboy_websocket, Req, #{"channel_id" => ChannelId}, Opts}
    end.

websocket_init(State) -> {ok, State}.

websocket_handle({text, Msg}, State) ->
    Msg0 = jiffy:decode(Msg, [return_maps]),
    {ok, MsgType} = maps:find(<<"type">>, Msg0),
    {ok, Target} = maps:find(<<"target">>, Msg0),
    {ok, TargetType} = maps:find(<<"type">>, Target),
    {ok, TargetId} = maps:find(<<"id">>, Target),
    {ok, ChannelId} = maps:find("channel_id", State),
    ResponseMsg = if
        TargetId == ChannelId andalso TargetType == <<"channel">> ->
            ChannelUuid = uuid:string_to_uuid(ChannelId),
            case channel_registry_server:query(ChannelUuid) of
                {ok, {ChannelConfig, _ChannelPid}} ->
                    case MsgType of
                        <<"channel.ping">> ->
                            jiffy:encode(maps:update(<<"type">>, <<"channel.pong">>, Msg0));
                        <<"channel.join">> ->
                            channel_server:join(ChannelUuid, self()),
                            Payload = #{
                                title => ChannelConfig#channel_config.title
                            },
                            jiffy:encode(#{
                                type => <<"channel.joined">>,
                                target => Target,
                                payload =>Payload
                            });
                        <<"channel.chat">> ->
                            channel_server:publish(ChannelUuid, self(), Msg),
                            jiffy:encode(maps:update(<<"type">>, <<"channel.chat.success">>, Msg0))
                    end;
                _ ->
                    jiffy:encode(#{
                        type => <<"error">>,
                        code => 100001
                    })
            end;
        true ->
            jiffy:encode(#{
                type => <<"error">>,
                code => 100000
            })
    end,
    {reply, {text, ResponseMsg}, State};
websocket_handle(_Data, State) -> {ok, State}.

websocket_info({chat, Msg}, State) ->
    {reply, {text, Msg}, State};
websocket_info(_Info, State) -> {ok, State}.

terminate(_Reason, State) ->
    case maps:find(<<"ChannelId">>, State) of
        {ok, ChannelId} ->
            channel_server:left(ChannelId, self()),
            ok;
        _ -> ok
    end.
