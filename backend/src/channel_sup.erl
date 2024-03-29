%%%-------------------------------------------------------------------
%% @doc channel supervisor.
%% @end
%%%-------------------------------------------------------------------

-module(channel_sup).

-behaviour(supervisor).

%% API
-export([start_channel/2, start_link/0]).

%% Supervisor callbacks
-export([init/1]).

-define(SERVER, ?MODULE).

%%====================================================================
%% API functions
%%====================================================================

start_channel(ChannelId, ChannelConfig) ->
    supervisor:start_child(channel_sup,
			   {{local, ChannelId},
			    {channel_server, start_link,
			     [ChannelId, ChannelConfig]},
			    transient, 11500, worker, [channel_server]}).

start_link() ->
    supervisor:start_link({local, ?SERVER}, ?MODULE, []).

%%====================================================================
%% Supervisor callbacks
%%====================================================================

%% Child :: {Id,StartFunc,Restart,Shutdown,Type,Modules}
init([]) ->
    ChildSpec = [{channel_registry_server,
		  {channel_registry_server, start_link, []}, permanent,
		  10500, worker, [channel_registry_server]}],
    {ok, {{one_for_one, 5, 10}, ChildSpec}}.

%%====================================================================
%% Internal functions
%%====================================================================

