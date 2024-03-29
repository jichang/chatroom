import React, { ChangeEvent } from "react";
import { Container } from "../Components/Container";
import { Link, RouteComponentProps } from "react-router-dom";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { Subscription, interval } from "rxjs";
import "./ChannelPage.css";
import { JoinMsg, Message, ChatMsg, ErrorMsg } from "../Models/Message";
import { PageStatus } from "../Models/PageStatus";
import { Spinner } from "../Components/Spinner";
import { IToast, Toast } from "../Components/Toast";
import { Dialog } from "../Components/Dialog";
import { DialogBody } from "../Components/DialogBody";
import { DialogFooter } from "../Components/DialogFooter";

interface Props extends RouteComponentProps<{ id: string }> {}

interface State {
  title: string;
  status: PageStatus;
  message: string;
  messages: string[];
  toast?: IToast;
  isExpired: boolean;
}

export class ChannelPage extends React.Component<Props, State> {
  webSocketSubject?: WebSocketSubject<any>;
  subscription?: Subscription;

  constructor(props: Props) {
    super(props);

    this.state = {
      status: PageStatus.Idle,
      title: "",
      message: "",
      messages: [],
      isExpired: false
    };
  }

  websocketUrl(path: string) {
    return `${window.location.protocol === "http:" ? "ws" : "wss"}://${
      window.location.host
    }/${path}`;
  }

  componentDidMount() {
    this.setState({
      status: PageStatus.Loading
    });
    const { match } = this.props;
    const channelId = match.params.id;

    this.webSocketSubject = webSocket(
      this.websocketUrl(`websocket?channel_id=${channelId}`)
    );
    this.subscription = this.webSocketSubject.subscribe(
      (data: Message) => {
        switch (data.type) {
          case "channel.info":
            this.setState({
              status: PageStatus.Ready,
              title: data.payload.title
            });
            break;
          case "channel.chat":
            this.setState({
              messages: [...this.state.messages, data.payload.content]
            });
            break;
        }
      },
      err => {
        if (err.type === "close") {
          let reason: ErrorMsg = JSON.parse(err.reason);
          this.setState({
            status: PageStatus.Error,
            isExpired: true
          });
        } else if (err.reason === "error") {
          this.setState({
            status: PageStatus.Error,
            toast: {
              message: "can not connect to channel",
              duration: 3000
            }
          });
        }
      }
    );

    const pingSubscription = interval(10000).subscribe(() => {
      if (this.webSocketSubject) {
        this.webSocketSubject.next({
          type: "channel.ping",
          target: {
            type: "channel",
            id: channelId
          }
        });
      }
    });
    this.subscription.add(pingSubscription);

    let joinMsg: JoinMsg = {
      type: "channel.join",
      target: {
        type: "channel",
        id: channelId
      }
    };
    this.webSocketSubject.next(joinMsg);
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }

  updateMessage = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      message: event.target.value
    });
  };

  submit = () => {
    if (!this.state.message || !this.webSocketSubject) {
      return;
    }

    const { match } = this.props;
    let chatMsg: ChatMsg = {
      type: "channel.chat",
      target: {
        type: "channel",
        id: match.params.id
      },
      payload: {
        content: this.state.message
      }
    };

    this.webSocketSubject.next(chatMsg);

    this.setState({
      message: "",
      messages: [...this.state.messages, this.state.message]
    });
  };

  render() {
    const { status, title, toast, isExpired } = this.state;
    if (status === PageStatus.Idle || status === PageStatus.Loading) {
      return <Spinner />;
    }

    return (
      <div className="page page--channel">
        <header className="page__header">
          <Container className={["flex__box", "flex__box--vc"]}>
            <h4 className="flex__item">{title}</h4>
            <Link className="button button--primary" to="/">
              Exit
            </Link>
          </Container>
        </header>
        <Container>
          <div style={{ position: "relative" }}>
            {toast ? (
              <Toast
                toast={toast}
                onEnd={() => {
                  this.setState({
                    toast: undefined
                  });
                }}
              />
            ) : null}
          </div>
        </Container>
        <main>
          <Container>
            {this.state.messages.map((message, index) => {
              return <p key={index}>{message}</p>;
            })}
          </Container>
        </main>
        <footer className="page__footer">
          <Container className="flex__box">
            <div className="flex__item">
              <input
                className="form__control"
                type="text"
                placeholder="Input message here"
                value={this.state.message}
                onChange={this.updateMessage}
              />
            </div>
            <button
              onClick={this.submit}
              className="button button--primary button--solid"
            >
              Send
            </button>
          </Container>
        </footer>
        <Dialog isShown={isExpired}>
          <DialogBody>
            <p>Channel has expired</p>
          </DialogBody>
          <DialogFooter className="text--center">
            <Link className="button button--primary button--solid" to="/">
              Back to Home
            </Link>
          </DialogFooter>
        </Dialog>
      </div>
    );
  }
}
